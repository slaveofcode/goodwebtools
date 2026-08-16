import { describe, it, expect } from 'vitest';
import { normalizeDragRect } from './redact.lib';

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
