import { describe, it, expect } from 'vitest';
import { normalizeDragRect, boxToRect, clampZoom, fitScale, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from './redact.lib';

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

describe('clampZoom', () => {
  it('leaves an in-range value on the step grid untouched', () => {
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('clamps below the minimum', () => {
    expect(clampZoom(0.01)).toBe(ZOOM_MIN);
  });

  it('clamps above the maximum', () => {
    expect(clampZoom(99)).toBe(ZOOM_MAX);
  });

  it('snaps to the nearest step so repeated +/- stay on a clean grid', () => {
    expect(clampZoom(1 + ZOOM_STEP + ZOOM_STEP / 3)).toBeCloseTo(1 + ZOOM_STEP, 6);
  });
});

describe('fitScale', () => {
  it('scales down a page wider than the viewport to fit its width', () => {
    // page 1000 wide, viewport 500 → 0.5; height not the limit
    expect(fitScale({ w: 1000, h: 1000 }, { w: 500, h: 5000 })).toBeCloseTo(0.5, 6);
  });

  it('is limited by height when the page is tall', () => {
    expect(fitScale({ w: 100, h: 1000 }, { w: 5000, h: 500 })).toBeCloseTo(0.5, 6);
  });

  it('never upscales past 1 when the page already fits', () => {
    expect(fitScale({ w: 100, h: 100 }, { w: 1000, h: 1000 })).toBe(1);
  });

  it('returns 1 when the viewport has not been measured yet', () => {
    expect(fitScale({ w: 1000, h: 1000 }, { w: 0, h: 0 })).toBe(1);
  });

  it('returns 1 for a not-yet-rendered page', () => {
    expect(fitScale({ w: 0, h: 0 }, { w: 500, h: 500 })).toBe(1);
  });
});
