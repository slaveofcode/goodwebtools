import { describe, it, expect } from 'vitest';
import { autoCorrelate, freqToNote } from './tuner.lib';

function sine(freq: number, sampleRate = 44100, samples = 2048): Float32Array {
  const buf = new Float32Array(samples);
  for (let i = 0; i < samples; i++) buf[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return buf;
}

describe('tuner', () => {
  it('detects the pitch of a synthetic sine', () => {
    const f = autoCorrelate(sine(440), 44100);
    expect(f).toBeGreaterThan(430);
    expect(f).toBeLessThan(450);
  });

  it('detects a low note too', () => {
    const f = autoCorrelate(sine(110), 44100);
    expect(f).toBeGreaterThan(105);
    expect(f).toBeLessThan(115);
  });

  it('returns -1 for silence', () => {
    expect(autoCorrelate(new Float32Array(2048), 44100)).toBe(-1);
  });

  it('maps 440 Hz to A4 in tune', () => {
    const r = freqToNote(440);
    expect(r.note).toBe('A');
    expect(r.octave).toBe(4);
    expect(Math.abs(r.cents)).toBeLessThanOrEqual(1);
    expect(r.inTune).toBe(true);
  });

  it('maps 261.63 Hz to C4', () => {
    const r = freqToNote(261.63);
    expect(r.note).toBe('C');
    expect(r.octave).toBe(4);
  });

  it('reports a sharp note as positive cents', () => {
    const r = freqToNote(445); // slightly sharp of A4
    expect(r.note).toBe('A');
    expect(r.cents).toBeGreaterThan(0);
    expect(r.inTune).toBe(false);
  });
});
