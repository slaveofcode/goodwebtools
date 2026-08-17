import { describe, it, expect } from 'vitest';
import { floatToWav, concatWithSilence, splitForPause } from './tts-audio.lib';

describe('floatToWav', () => {
  it('writes a valid mono PCM16 WAV header', () => {
    const wav = floatToWav(new Float32Array([0, 0.5, -0.5]), 16000);
    const str = (o: number, n: number) => String.fromCharCode(...wav.slice(o, o + n));
    expect(str(0, 4)).toBe('RIFF');
    expect(str(8, 4)).toBe('WAVE');
    expect(str(36, 4)).toBe('data');
    const dv = new DataView(wav.buffer);
    expect(dv.getUint16(20, true)).toBe(1); // PCM
    expect(dv.getUint16(22, true)).toBe(1); // mono
    expect(dv.getUint32(24, true)).toBe(16000); // sample rate
    expect(dv.getUint16(34, true)).toBe(16); // bits per sample
    expect(wav.length).toBe(44 + 3 * 2);
  });

  it('quantises samples to 16-bit and clamps overflow', () => {
    const wav = floatToWav(new Float32Array([0, 1, -1, 2]), 8000);
    const dv = new DataView(wav.buffer);
    expect(dv.getInt16(44, true)).toBe(0);
    expect(dv.getInt16(46, true)).toBe(32767); // +1 full scale
    expect(dv.getInt16(48, true)).toBe(-32768); // -1 full scale
    expect(dv.getInt16(50, true)).toBe(32767); // 2 clamps to +1
  });
});

describe('concatWithSilence', () => {
  it('joins segments with N samples of silence between them', () => {
    const out = concatWithSilence([new Float32Array([1, 2]), new Float32Array([3])], 2);
    expect(Array.from(out)).toEqual([1, 2, 0, 0, 3]);
  });
  it('adds no trailing silence and handles a single segment', () => {
    expect(Array.from(concatWithSilence([new Float32Array([5])], 3))).toEqual([5]);
    expect(concatWithSilence([], 3).length).toBe(0);
  });
});

describe('splitForPause', () => {
  it('splits on [pause] markers and blank lines', () => {
    expect(splitForPause('Hello [pause] world\n\nBye')).toEqual(['Hello', 'world', 'Bye']);
  });
  it('trims and drops empty segments', () => {
    expect(splitForPause('  one  [pause]   [pause] two ')).toEqual(['one', 'two']);
  });
  it('returns the whole text when there are no markers', () => {
    expect(splitForPause('just one line')).toEqual(['just one line']);
  });
});
