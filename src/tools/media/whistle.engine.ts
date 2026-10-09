/**
 * Voice to Text — the "Fast" engine: Cactus Whistle (Apache-2.0) running in the
 * single-threaded Needle WASM runtime. Runs inside the STT worker.
 *
 * Assets: the JS wrapper is vendored (src/vendor/needle); needle.wasm and
 * whistle.cact are fetched through our same-origin /hf proxy, pinned to exact
 * Hugging Face commits, SHA-256 verified, and kept in Cache Storage so later
 * visits (and offline use) don't download them again. Audio never leaves the
 * device — only these model files are fetched.
 */
import { planChunks, offsetWords, parseWhistleOutput, type WhistleOutput, type WhistleWord } from './whistle.lib';

export interface PinnedAsset {
  repo: string;
  commit: string;
  path: string;
  sha256: string;
}

export const WHISTLE_ASSETS = {
  wasm: {
    repo: 'Cactus-Compute/needle3',
    commit: '2ae11323dc000f5e70c49f7403efa6af12ba9e67',
    path: 'wasm/needle.wasm',
    sha256: 'c43f48e11f302087250d1e406024956781cd2f02595a5e343b3d7ddd5ef707fa',
  },
  model: {
    repo: 'Cactus-Compute/whistle',
    commit: 'b358ddadd89b7a713b5aa131f23032d3cca1b251',
    path: 'whistle.cact',
    sha256: 'b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb',
  },
} satisfies Record<string, PinnedAsset>;

/** Cache Storage bucket for the verified files (bump the suffix when assets change). */
export const WHISTLE_CACHE = 'whistle-v1';

const RATE = 16000;
/** Engine output buffer (JSON with per-word timestamps for up to 30 s). */
const OUT_CAPACITY = 1 << 20;

/** Same-origin /hf proxy on the site; Hugging Face directly on localhost (no Worker there). */
export function assetUrl(asset: PinnedAsset, origin: string): string {
  const path = `${asset.repo}/resolve/${asset.commit}/${asset.path}`;
  return /localhost|127\.0\.0\.1|\[::1\]/.test(origin) || !origin ? `https://huggingface.co/${path}` : `${origin}/hf/${path}`;
}

interface CacheLike {
  match(url: string): Promise<Response | undefined>;
  put(url: string, res: Response): Promise<void>;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Fetch (or reuse from cache) a file and verify its SHA-256 before handing it out. */
export async function fetchVerified(
  url: string,
  sha256: string,
  opts: { cache?: CacheLike; fetchImpl?: typeof fetch; onProgress?: (ratio: number) => void } = {},
): Promise<Uint8Array> {
  const cached = await opts.cache?.match(url);
  if (cached) {
    opts.onProgress?.(1);
    return new Uint8Array(await cached.arrayBuffer());
  }

  const res = await (opts.fetchImpl ?? fetch)(url);
  if (!res.ok) throw new Error(`Model download failed (HTTP ${res.status})`);

  const total = Number(res.headers.get('content-length') || 0);
  let bytes: Uint8Array;
  if (res.body && total > 0 && opts.onProgress) {
    const reader = res.body.getReader();
    bytes = new Uint8Array(total);
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (got + value.length > bytes.length) {
        const grown = new Uint8Array(got + value.length);
        grown.set(bytes.subarray(0, got));
        bytes = grown;
      }
      bytes.set(value, got);
      got += value.length;
      opts.onProgress(Math.min(1, got / total));
    }
    bytes = bytes.subarray(0, got);
  } else {
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  opts.onProgress?.(1);

  if ((await sha256Hex(bytes)) !== sha256) throw new Error('Model file failed its integrity check — please try again.');
  await opts.cache?.put(url, new Response(bytes.slice()));
  return bytes;
}

/** The subset of the Emscripten module the engine uses. */
export interface NeedleModule {
  HEAPU8: Uint8Array;
  _malloc(n: number): number;
  _free(ptr: number): void;
  _needle_load(ptr: number, n: bigint): number;
  _needle_last_error(): number;
  _needle_transcribe(pcm: number, samples: number, lang: number, keywords: number, wordTs: number, out: number, cap: number): number;
  _needle_stream_transcribe_process(pcm: number, samples: number, lang: number, keywords: number, out: number, cap: number): number;
  _needle_stream_transcribe_stop(out: number, cap: number): number;
}

export interface WhistleEngine {
  /** Transcribe any length of 16 kHz mono audio (split into ≤30 s windows). */
  transcribe(pcm: Float32Array, language: string | null): Promise<{ words: WhistleWord[]; language: string }>;
  /** Live: append ~1 s of audio; returns newly committed words + the pending tail. */
  streamProcess(pcm: Float32Array, language: string | null): WhistleOutput;
  /** Live: end the stream; the pending tail becomes committed words. */
  streamStop(): WhistleOutput;
}

export interface WhistleDeps {
  /** Builds the Emscripten module from the wasm bytes (vendored createNeedle by default). */
  factory?: (wasmBinary: Uint8Array) => Promise<NeedleModule>;
  wasm?: () => Promise<Uint8Array>;
  model?: () => Promise<Uint8Array>;
}

function readCString(M: NeedleModule, ptr: number): string {
  const heap = M.HEAPU8;
  let end = ptr;
  while (heap[end]) end++;
  return new TextDecoder().decode(heap.subarray(ptr, end));
}

/** Heap is single-threaded and may grow, so always re-read M.HEAPU8 after allocating. */
function writeBytes(M: NeedleModule, bytes: Uint8Array): number {
  const ptr = M._malloc(bytes.length);
  M.HEAPU8.set(bytes, ptr);
  return ptr;
}

function writeFloats(M: NeedleModule, pcm: Float32Array): number {
  return writeBytes(M, new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
}

function writeCString(M: NeedleModule, s: string | null): number {
  if (!s) return 0;
  const b = new TextEncoder().encode(s);
  const ptr = M._malloc(b.length + 1);
  M.HEAPU8.set(b, ptr);
  M.HEAPU8[ptr + b.length] = 0;
  return ptr;
}

/** Download (or reuse) the verified assets and start the engine. */
export async function createWhistle(deps: WhistleDeps = {}, onProgress?: (ratio: number) => void): Promise<WhistleEngine> {
  const origin = typeof self !== 'undefined' && self.location ? self.location.origin : '';
  const cache = typeof caches !== 'undefined' ? await caches.open(WHISTLE_CACHE).catch(() => undefined) : undefined;
  // The model is ~95% of the bytes, so it drives the progress bar.
  const wasmBytes = await (deps.wasm ?? (() => fetchVerified(assetUrl(WHISTLE_ASSETS.wasm, origin), WHISTLE_ASSETS.wasm.sha256, { cache })))();
  const modelBytes = await (deps.model ?? (() => fetchVerified(assetUrl(WHISTLE_ASSETS.model, origin), WHISTLE_ASSETS.model.sha256, { cache, onProgress })))();

  const factory = deps.factory ?? (async (wasmBinary: Uint8Array) => {
    const { default: createNeedle } = await import('../../vendor/needle/needle.mjs');
    return (await createNeedle({ wasmBinary })) as NeedleModule;
  });
  const M = await factory(wasmBytes);

  const modelPtr = writeBytes(M, modelBytes);
  const rc = M._needle_load(modelPtr, BigInt(modelBytes.length));
  M._free(modelPtr);
  if (rc < 0) throw new Error(readCString(M, M._needle_last_error()) || 'Could not load the speech model.');

  const out = M._malloc(OUT_CAPACITY);
  const check = (n: number) => {
    if (n < 0) throw new Error(readCString(M, M._needle_last_error()) || 'Transcription failed.');
  };

  const transcribeWindow = (pcm: Float32Array, language: string | null): WhistleOutput => {
    const pcmPtr = writeFloats(M, pcm);
    const langPtr = writeCString(M, language);
    try {
      check(M._needle_transcribe(pcmPtr, pcm.length, langPtr, 0, 1, out, OUT_CAPACITY));
      return parseWhistleOutput(readCString(M, out));
    } finally {
      M._free(pcmPtr);
      if (langPtr) M._free(langPtr);
    }
  };

  return {
    async transcribe(pcm, language) {
      const words: WhistleWord[] = [];
      let detected = language ?? '';
      for (const chunk of planChunks(pcm, RATE)) {
        const res = transcribeWindow(pcm.subarray(chunk.start, chunk.end), language);
        if (!detected && res.language) detected = res.language;
        words.push(...offsetWords(res.words, chunk.start / RATE));
        // Yield between windows so progress messages can flow.
        await new Promise(r => setTimeout(r, 0));
      }
      return { words, language: detected };
    },

    streamProcess(pcm, language) {
      const pcmPtr = writeFloats(M, pcm);
      const langPtr = writeCString(M, language);
      try {
        check(M._needle_stream_transcribe_process(pcmPtr, pcm.length, langPtr, 0, out, OUT_CAPACITY));
        return parseWhistleOutput(readCString(M, out));
      } finally {
        M._free(pcmPtr);
        if (langPtr) M._free(langPtr);
      }
    },

    streamStop() {
      check(M._needle_stream_transcribe_stop(out, OUT_CAPACITY));
      return parseWhistleOutput(readCString(M, out));
    },
  };
}
