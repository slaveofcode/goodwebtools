import { describe, it, expect } from 'vitest';
import {
  toWhistleLang,
  isWhistleLanguage,
  resolveModel,
  defaultLanguageFor,
  planChunks,
  parseWhistleOutput,
  offsetWords,
  wordsToSegments,
  downsampleTo16k,
  type WhistleWord,
} from './whistle.lib';

describe('language mapping', () => {
  it.each([
    ['english', 'en'], ['german', 'de'], ['french', 'fr'], ['spanish', 'es'],
    ['italian', 'it'], ['dutch', 'nl'], ['polish', 'pl'],
  ])('%s → %s', (name, code) => {
    expect(toWhistleLang(name)).toBe(code);
    expect(isWhistleLanguage(name)).toBe(true);
  });

  it('treats auto-detect as supported with no explicit code', () => {
    expect(toWhistleLang('')).toBeNull();
    expect(isWhistleLanguage('')).toBe(true);
  });

  it.each(['indonesian', 'japanese', 'javanese', 'portuguese'])('%s is not a Whistle language', name => {
    expect(isWhistleLanguage(name)).toBe(false);
    expect(toWhistleLang(name)).toBeUndefined();
  });
});

describe('resolveModel', () => {
  it('keeps Whistle for its languages and auto-detect', () => {
    expect(resolveModel('whistle', 'german')).toEqual({ model: 'whistle', switched: false });
    expect(resolveModel('whistle', '')).toEqual({ model: 'whistle', switched: false });
  });

  it('switches to Whisper base for unsupported languages', () => {
    expect(resolveModel('whistle', 'indonesian')).toEqual({ model: 'onnx-community/whisper-base', switched: true });
  });

  it('leaves Whisper models alone', () => {
    expect(resolveModel('onnx-community/whisper-small', 'indonesian')).toEqual({ model: 'onnx-community/whisper-small', switched: false });
    expect(resolveModel('onnx-community/whisper-base', 'english')).toEqual({ model: 'onnx-community/whisper-base', switched: false });
  });

  it('picks per-locale defaults', () => {
    expect(defaultLanguageFor('en')).toBe('');
    expect(defaultLanguageFor('id')).toBe('indonesian');
  });
});

describe('planChunks', () => {
  const RATE = 16000;
  const tone = (seconds: number) => {
    const a = new Float32Array(Math.round(seconds * RATE));
    for (let i = 0; i < a.length; i++) a[i] = 0.5 * Math.sin(i / 5);
    return a;
  };

  it('returns one chunk for short audio', () => {
    expect(planChunks(tone(12))).toEqual([{ start: 0, end: 12 * RATE }]);
    expect(planChunks(new Float32Array(0))).toEqual([]);
  });

  it('cuts long audio at the quietest point near the window end', () => {
    const pcm = tone(50);
    // A 0.3 s silence at 27.0 s, inside the last 5 s of the first 30 s window.
    pcm.fill(0, 27 * RATE, 27.3 * RATE);
    const chunks = planChunks(pcm);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].end / RATE).toBeGreaterThanOrEqual(27);
    expect(chunks[0].end / RATE).toBeLessThanOrEqual(27.3);
    expect(chunks[1]).toEqual({ start: chunks[0].end, end: pcm.length });
  });

  it('never exceeds the window and covers every sample exactly once', () => {
    const pcm = tone(95);
    const chunks = planChunks(pcm);
    expect(chunks[0].start).toBe(0);
    expect(chunks.at(-1)!.end).toBe(pcm.length);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].end - chunks[i].start).toBeLessThanOrEqual(30 * RATE);
      if (i > 0) expect(chunks[i].start).toBe(chunks[i - 1].end);
    }
  });
});

describe('parseWhistleOutput', () => {
  it('reads transcript, language and words', () => {
    const out = parseWhistleOutput('{"text":"Hi there.","language":"en","words":[{"word":"Hi","start":0.1,"end":0.3,"probability":0.9},{"word":"there.","start":0.3,"end":0.7,"probability":0.8}],"ttft_ms":5,"decode_tps":40}');
    expect(out.text).toBe('Hi there.');
    expect(out.language).toBe('en');
    expect(out.words.map(w => w.word)).toEqual(['Hi', 'there.']);
  });

  it('reads the pending tail of a live stream and tolerates missing fields', () => {
    expect(parseWhistleOutput('{"text":"","pending":"and then","language":"en"}')).toMatchObject({ text: '', words: [], pending: 'and then' });
    expect(() => parseWhistleOutput('not json')).toThrow();
  });
});

describe('offsetWords', () => {
  it('shifts word times by the chunk start', () => {
    const w: WhistleWord[] = [{ word: 'a', start: 1, end: 1.5, probability: 1 }];
    expect(offsetWords(w, 30)).toEqual([{ word: 'a', start: 31, end: 31.5, probability: 1 }]);
  });
});

describe('wordsToSegments', () => {
  const w = (word: string, start: number, end: number): WhistleWord => ({ word, start, end, probability: 1 });

  it('breaks cues at sentence ends', () => {
    const segs = wordsToSegments([w('Hello', 0, 0.4), w('world.', 0.4, 0.9), w('Next', 1.0, 1.3), w('one.', 1.3, 1.6)]);
    expect(segs).toEqual([
      { start: 0, end: 0.9, text: 'Hello world.' },
      { start: 1.0, end: 1.6, text: 'Next one.' },
    ]);
  });

  it('breaks on long pauses and on line length', () => {
    const paused = wordsToSegments([w('wait', 0, 0.3), w('for', 0.3, 0.5), w('it', 2.0, 2.2)]);
    expect(paused.map(s => s.text)).toEqual(['wait for', 'it']);

    const many = Array.from({ length: 20 }, (_, i) => w('word', i * 0.25, i * 0.25 + 0.2));
    const segs = wordsToSegments(many);
    expect(segs.length).toBeGreaterThan(1);
    for (const s of segs) expect(s.text.length).toBeLessThanOrEqual(42);
    expect(segs.map(s => s.text).join(' ')).toBe(many.map(x => x.word).join(' '));
  });

  it('caps cue duration', () => {
    const slow = Array.from({ length: 6 }, (_, i) => w('slow', i * 1.5, i * 1.5 + 1.2));
    for (const s of wordsToSegments(slow)) expect(s.end - s.start).toBeLessThanOrEqual(6);
  });

  it('returns nothing for no words', () => {
    expect(wordsToSegments([])).toEqual([]);
  });
});

describe('downsampleTo16k', () => {
  it('passes 16 kHz through unchanged', () => {
    const a = new Float32Array([0.1, 0.2, 0.3]);
    expect(downsampleTo16k(a, 16000)).toBe(a);
  });

  it('averages blocks when downsampling 48 kHz by 3', () => {
    const a = new Float32Array([0, 0.3, 0.6, 0.3, 0.3, 0.3]);
    expect(Array.from(downsampleTo16k(a, 48000)).map(v => +v.toFixed(5))).toEqual([0.3, 0.3]);
  });

  it('handles non-integer ratios (44.1 kHz) with the right length', () => {
    const a = new Float32Array(44100).fill(0.5);
    const out = downsampleTo16k(a, 44100);
    expect(out.length).toBe(16000);
    expect(Math.max(...out)).toBeCloseTo(0.5);
    expect(Math.min(...out)).toBeCloseTo(0.5);
  });
});
