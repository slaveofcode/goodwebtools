import { describe, it, expect } from 'vitest';
import { BANDS, binauralFreqs, clampCarrier, clampBeat, bandByKey } from './binaural.lib';

describe('binaural', () => {
  it('splits a carrier symmetrically by the beat', () => {
    expect(binauralFreqs(200, 10)).toEqual([195, 205]);
  });

  it('the difference between channels equals the beat frequency', () => {
    const [l, r] = binauralFreqs(300, 7);
    expect(r - l).toBeCloseTo(7, 6);
  });

  it('clamps carrier and beat to sane ranges', () => {
    expect(clampCarrier(10)).toBe(50);
    expect(clampCarrier(9000)).toBe(500);
    expect(clampBeat(0)).toBe(0.5);
    expect(clampBeat(999)).toBe(50);
  });

  it('bandByKey finds a band and defaults to alpha', () => {
    expect(bandByKey('theta').label).toBe('Theta');
    expect(bandByKey('nope').key).toBe('alpha');
  });

  it('every band has ascending-ish beat within range', () => {
    expect(BANDS.every((b) => b.beat >= 0.5 && b.beat <= 50)).toBe(true);
  });
});
