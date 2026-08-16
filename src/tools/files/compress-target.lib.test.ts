import { describe, it, expect } from 'vitest';
import { targetToBytes, pctSmaller, formatSize, TARGET_PRESETS } from './compress-target.lib';

describe('targetToBytes', () => {
  it('converts KB and MB', () => {
    expect(targetToBytes(100, 'KB')).toBe(102400);
    expect(targetToBytes(1, 'MB')).toBe(1048576);
    expect(targetToBytes(0.5, 'MB')).toBe(524288);
  });
  it('never returns negative', () => {
    expect(targetToBytes(-5, 'KB')).toBe(0);
  });
});

describe('pctSmaller', () => {
  it('computes reduction', () => {
    expect(pctSmaller(1000, 250)).toBe(75);
    expect(pctSmaller(0, 100)).toBe(0);
  });
});

describe('formatSize', () => {
  it.each([
    [500, '500 B'],
    [1536, '1.5 KB'],
    [102400, '100.0 KB'],
    [1572864, '1.50 MB'],
  ])('formats %i bytes as %s', (b, s) => {
    expect(formatSize(b)).toBe(s);
  });
});

describe('TARGET_PRESETS', () => {
  it('includes the common Indonesian upload caps', () => {
    expect(TARGET_PRESETS.map(p => p.bytes)).toContain(100 * 1024);
    expect(TARGET_PRESETS.map(p => p.bytes)).toContain(500 * 1024);
  });
});
