import { describe, it, expect } from 'vitest';
import { rms, peak, dbfs, toMeter } from './mic-level.lib';

describe('mic-level', () => {
  it('rms of silence is 0', () => {
    expect(rms(new Float32Array(128))).toBe(0);
  });

  it('rms of a full-scale square wave is 1', () => {
    const s = Float32Array.from({ length: 100 }, (_, i) => (i % 2 ? 1 : -1));
    expect(rms(s)).toBeCloseTo(1, 5);
  });

  it('peak returns the largest absolute sample', () => {
    expect(peak([0.1, -0.9, 0.3])).toBeCloseTo(0.9, 5);
  });

  it('dbfs of full scale is 0 dB', () => {
    expect(dbfs(1)).toBeCloseTo(0, 5);
  });

  it('dbfs of half amplitude is about -6 dB', () => {
    expect(dbfs(0.5)).toBeCloseTo(-6.02, 1);
  });

  it('dbfs of silence is -Infinity', () => {
    expect(dbfs(0)).toBe(-Infinity);
  });

  it('toMeter is 0 at silence and 100 at full scale', () => {
    expect(toMeter(0)).toBe(0);
    expect(toMeter(1)).toBe(100);
  });

  it('toMeter is monotonic with amplitude', () => {
    expect(toMeter(0.1)).toBeLessThan(toMeter(0.5));
    expect(toMeter(0.5)).toBeLessThan(toMeter(1));
  });
});
