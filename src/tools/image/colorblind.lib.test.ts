import { describe, it, expect } from 'vitest';
import { CVD_TYPES, simulateRGB } from './colorblind.lib';

describe('CVD_TYPES', () => {
  it('covers the three dichromacies plus achromatopsia', () => {
    const ids = CVD_TYPES.map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining(['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']));
  });
});

describe('simulateRGB', () => {
  it('leaves white and black unchanged (matrix rows sum to 1)', () => {
    for (const type of CVD_TYPES) {
      expect(simulateRGB([255, 255, 255], type.id)).toEqual([255, 255, 255]);
      expect(simulateRGB([0, 0, 0], type.id)).toEqual([0, 0, 0]);
    }
  });

  it('turns colour into grey for achromatopsia', () => {
    const [r, g, b] = simulateRGB([255, 0, 0], 'achromatopsia');
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('clamps to the 0–255 range and returns integers', () => {
    const out = simulateRGB([255, 128, 0], 'protanopia');
    for (const c of out) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(255);
    }
  });
});
