import { describe, it, expect } from 'vitest';
import { TEST_TONES, panFor, sweepFrequencies } from './tone.lib';

describe('tone', () => {
  it('has ascending test-tone frequencies', () => {
    for (let i = 1; i < TEST_TONES.length; i++) {
      expect(TEST_TONES[i].hz).toBeGreaterThan(TEST_TONES[i - 1].hz);
    }
  });

  it('pans left/right/both correctly', () => {
    expect(panFor('left')).toBe(-1);
    expect(panFor('right')).toBe(1);
    expect(panFor('both')).toBe(0);
  });

  it('sweep starts and ends at the given bounds', () => {
    const f = sweepFrequencies(10, 20, 20000);
    expect(f[0]).toBe(20);
    expect(f[f.length - 1]).toBe(20000);
    expect(f).toHaveLength(10);
  });

  it('sweep is strictly increasing', () => {
    const f = sweepFrequencies(20);
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThanOrEqual(f[i - 1]);
  });

  it('sweep with one step returns the low bound', () => {
    expect(sweepFrequencies(1, 100, 200)).toEqual([100]);
  });
});
