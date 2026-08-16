import { describe, it, expect } from 'vitest';
import { normalizeDragRect, boxToRect } from './redact.lib';

describe('normalizeDragRect', () => {
  it('converts a top-left → bottom-right drag to ratios', () => {
    expect(normalizeDragRect(50, 100, 150, 200, 200, 400)).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.25 });
  });

  it('handles an inverted (bottom-right → top-left) drag', () => {
    expect(normalizeDragRect(150, 200, 50, 100, 200, 400)).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.25 });
  });

  it('clamps a drag that runs past the edges', () => {
    const r = normalizeDragRect(-20, -20, 260, 500, 200, 400);
    expect(r).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('reports zero size for a click without movement', () => {
    const r = normalizeDragRect(100, 100, 100, 100, 200, 400);
    expect(r.w).toBe(0);
    expect(r.h).toBe(0);
  });
});

describe('boxToRect', () => {
  it('maps a box to a mupdf rect with no vertical flip (top-left origin)', () => {
    // Box near the bottom of the page stays near the bottom (large y).
    const r = boxToRect({ x: 0.1, y: 0.8, w: 0.2, h: 0.1 }, [0, 0, 100, 200]);
    [10, 160, 30, 180].forEach((v, i) => expect(r[i]).toBeCloseTo(v, 6));
  });

  it('maps a top box to small y', () => {
    expect(boxToRect({ x: 0, y: 0, w: 1, h: 0.25 }, [0, 0, 100, 200])).toEqual([0, 0, 100, 50]);
  });

  it('honours a non-zero page origin (CropBox offset)', () => {
    expect(boxToRect({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, [10, 20, 110, 220])).toEqual([60, 120, 110, 220]);
  });
});
