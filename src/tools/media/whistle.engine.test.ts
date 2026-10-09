import { describe, it, expect, vi } from 'vitest';
import { assetUrl, fetchVerified, createWhistle, WHISTLE_ASSETS, type NeedleModule } from './whistle.engine';

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

describe('assetUrl', () => {
  it('goes through the /hf proxy on the site and straight to Hugging Face on localhost', () => {
    const a = WHISTLE_ASSETS.model;
    expect(assetUrl(a, 'https://goodwebtools.com')).toBe(`https://goodwebtools.com/hf/${a.repo}/resolve/${a.commit}/${a.path}`);
    expect(assetUrl(a, 'http://localhost:4321')).toBe(`https://huggingface.co/${a.repo}/resolve/${a.commit}/${a.path}`);
  });
});

describe('fetchVerified', () => {
  const body = new TextEncoder().encode('model-bytes');

  function fakeCache() {
    const store = new Map<string, Response>();
    return {
      store,
      cache: {
        match: vi.fn(async (u: string) => store.get(u)?.clone()),
        put: vi.fn(async (u: string, r: Response) => { store.set(u, r); }),
      },
    };
  }

  it('downloads, verifies, caches and reports progress', async () => {
    const { cache, store } = fakeCache();
    const fetchImpl = vi.fn(async () => new Response(body, { headers: { 'content-length': String(body.length) } }));
    const progress: number[] = [];
    const out = await fetchVerified('https://x/m', await sha256(body), { cache, fetchImpl, onProgress: r => progress.push(r) });
    expect(new TextDecoder().decode(out)).toBe('model-bytes');
    expect(store.has('https://x/m')).toBe(true);
    expect(progress.at(-1)).toBe(1);
  });

  it('serves a cached copy without fetching', async () => {
    const { cache, store } = fakeCache();
    store.set('https://x/m', new Response(body));
    const fetchImpl = vi.fn();
    const out = await fetchVerified('https://x/m', await sha256(body), { cache, fetchImpl });
    expect(out.length).toBe(body.length);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a file whose hash does not match, and does not cache it', async () => {
    const { cache, store } = fakeCache();
    const fetchImpl = vi.fn(async () => new Response(body));
    await expect(fetchVerified('https://x/m', '00'.repeat(32), { cache, fetchImpl })).rejects.toThrow(/integrity/i);
    expect(store.size).toBe(0);
  });

  it('reports HTTP errors', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }));
    await expect(fetchVerified('https://x/m', '00', { fetchImpl })).rejects.toThrow(/503/);
  });
});

/** A tiny fake of the Emscripten module: bump allocator + scripted engine calls. */
function fakeModule(opts: { failLoad?: boolean } = {}) {
  const HEAPU8 = new Uint8Array(1 << 24);
  let next = 16;
  const calls: { samples: number; lang: string | null; first: number }[] = [];
  const readStr = (p: number) => { if (!p) return null; let e = p; while (HEAPU8[e]) e++; return new TextDecoder().decode(HEAPU8.subarray(p, e)); };
  const writeStr = (s: string, p: number) => { const b = new TextEncoder().encode(s); HEAPU8.set(b, p); HEAPU8[p + b.length] = 0; };
  const errPtr = 8000;
  const M: NeedleModule = {
    HEAPU8,
    _malloc: (n: number) => { const p = next; next += n + 8; return p; },
    _free: () => {},
    _needle_load: () => (opts.failLoad ? -1 : 0),
    _needle_last_error: () => { writeStr('bad model', errPtr); return errPtr; },
    _needle_transcribe: (pcm: number, samples: number, lang: number, _kw: number, _ts: number, out: number) => {
      const first = new Float32Array(HEAPU8.buffer.slice(pcm, pcm + 4))[0];
      calls.push({ samples, lang: readStr(lang), first });
      writeStr(JSON.stringify({ text: `chunk${calls.length}.`, language: 'en', words: [{ word: `chunk${calls.length}.`, start: 0.5, end: 1, probability: 0.9 }] }), out);
      return 1;
    },
    _needle_stream_transcribe_process: (_p: number, samples: number, _l: number, _k: number, out: number) => {
      writeStr(JSON.stringify({ text: 'hello', words: [{ word: 'hello', start: 0, end: 0.4, probability: 1 }], pending: 'wor', language: 'en', received: samples / 16000 }), out);
      return 1;
    },
    _needle_stream_transcribe_stop: (out: number) => {
      writeStr(JSON.stringify({ text: 'world.', words: [{ word: 'world.', start: 0.5, end: 0.9, probability: 1 }], language: 'en' }), out);
      return 1;
    },
  };
  return { M, calls };
}

describe('createWhistle', () => {
  const load = { wasm: async () => new Uint8Array(4), model: async () => new Uint8Array(8) };

  it('transcribes long audio in windows and offsets word times', async () => {
    const { M, calls } = fakeModule();
    const w = await createWhistle({ factory: async () => M, ...load });
    const pcm = new Float32Array(16000 * 45).fill(0.25);
    pcm[0] = 0.75;
    const res = await w.transcribe(pcm, 'de');
    expect(calls).toHaveLength(2);
    expect(calls[0].lang).toBe('de');
    expect(calls[0].first).toBeCloseTo(0.75); // floats copied into the heap intact
    expect(calls[0].samples + calls[1].samples).toBe(pcm.length);
    expect(res.words.map(x => x.word)).toEqual(['chunk1.', 'chunk2.']);
    expect(res.words[1].start).toBeCloseTo(calls[0].samples / 16000 + 0.5);
  });

  it('passes no language for auto-detect', async () => {
    const { M, calls } = fakeModule();
    const w = await createWhistle({ factory: async () => M, ...load });
    await w.transcribe(new Float32Array(1600), null);
    expect(calls[0].lang).toBeNull();
  });

  it('streams live audio and finalises the tail', async () => {
    const { M } = fakeModule();
    const w = await createWhistle({ factory: async () => M, ...load });
    const step = w.streamProcess(new Float32Array(16000), 'en');
    expect(step.words.map(x => x.word)).toEqual(['hello']);
    expect(step.pending).toBe('wor');
    expect(w.streamStop().words.map(x => x.word)).toEqual(['world.']);
  });

  it('surfaces the engine error when the model fails to load', async () => {
    const { M } = fakeModule({ failLoad: true });
    await expect(createWhistle({ factory: async () => M, ...load })).rejects.toThrow('bad model');
  });
});
