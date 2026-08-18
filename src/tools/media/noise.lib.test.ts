import { describe, it, expect } from 'vitest';
import { makeNoise, meanAbsDelta, NOISE_TYPES } from './noise.lib';

// Deterministic RNG for reproducible tests.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('noise', () => {
  it('produces the requested length', () => {
    expect(makeNoise(1000, 'white', seeded(1))).toHaveLength(1000);
  });

  it('white noise stays roughly within [-1, 1]', () => {
    const n = makeNoise(2000, 'white', seeded(2));
    expect(Math.max(...n)).toBeLessThanOrEqual(1);
    expect(Math.min(...n)).toBeGreaterThanOrEqual(-1);
  });

  it('brown noise is smoother (lower delta) than white', () => {
    const white = makeNoise(4000, 'white', seeded(3));
    const brown = makeNoise(4000, 'brown', seeded(3));
    expect(meanAbsDelta(brown)).toBeLessThan(meanAbsDelta(white));
  });

  it('pink noise sits between white and brown in brightness', () => {
    const white = meanAbsDelta(makeNoise(4000, 'white', seeded(4)));
    const pink = meanAbsDelta(makeNoise(4000, 'pink', seeded(4)));
    const brown = meanAbsDelta(makeNoise(4000, 'brown', seeded(4)));
    expect(pink).toBeLessThan(white);
    expect(pink).toBeGreaterThan(brown);
  });

  it('is reproducible for a given seed', () => {
    expect(Array.from(makeNoise(50, 'pink', seeded(9)))).toEqual(Array.from(makeNoise(50, 'pink', seeded(9))));
  });

  it('exposes the three noise types', () => {
    expect(NOISE_TYPES.map((n) => n.key)).toEqual(['white', 'pink', 'brown']);
  });
});
