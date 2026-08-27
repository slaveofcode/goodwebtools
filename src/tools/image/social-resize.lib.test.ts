import { describe, it, expect } from 'vitest';
import { fitRect, SOCIAL_PRESETS } from './social-resize.lib';

describe('fitRect cover', () => {
  it('crops the sides of a wide source', () => {
    // 2000×1000 (2:1) into 1000×1000 (1:1) → crop width to 1000.
    const r = fitRect(2000, 1000, 1000, 1000, 'cover');
    expect(r.sw).toBe(1000);
    expect(r.sh).toBe(1000);
    expect(r.sx).toBe(500);
    expect(r.sy).toBe(0);
    expect(r).toMatchObject({ dx: 0, dy: 0, dw: 1000, dh: 1000 });
  });
  it('crops top/bottom of a tall source', () => {
    // 1000×1000 into 1600×900 (16:9) → crop height.
    const r = fitRect(1000, 1000, 1600, 900, 'cover');
    expect(r.sw).toBe(1000);
    expect(r.sh).toBeCloseTo(562.5, 1);
    expect(r.sy).toBeCloseTo(218.75, 1);
  });
});

describe('fitRect contain', () => {
  it('letterboxes a square into a wide target', () => {
    const r = fitRect(1000, 1000, 1600, 900, 'contain');
    expect(r.dw).toBe(900);
    expect(r.dh).toBe(900);
    expect(r.dx).toBe(350);
    expect(r.dy).toBe(0);
  });
});

describe('SOCIAL_PRESETS', () => {
  it('has sane dimensions', () => {
    expect(SOCIAL_PRESETS.length).toBeGreaterThan(4);
    for (const p of SOCIAL_PRESETS) {
      expect(p.w).toBeGreaterThan(0);
      expect(p.h).toBeGreaterThan(0);
    }
  });
});
