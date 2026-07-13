import { describe, it, expect } from 'vitest';
import { expandBox } from './face-blur.lib';

describe('expandBox', () => {
  it('grows a box around its center', () => {
    expect(expandBox({ x: 100, y: 100, w: 100, h: 100 }, 0.4, 1000, 1000)).toEqual({
      x: 80,
      y: 80,
      w: 140,
      h: 140,
    });
  });

  it('clamps to the image bounds', () => {
    // Near the top-left corner: expansion can't go negative.
    expect(expandBox({ x: 10, y: 10, w: 100, h: 100 }, 1, 500, 500)).toEqual({
      x: 0,
      y: 0,
      w: 160,
      h: 160,
    });
  });

  it('clamps to the right/bottom edges', () => {
    const b = expandBox({ x: 400, y: 400, w: 100, h: 100 }, 0.5, 500, 500);
    expect(b.x + b.w).toBeLessThanOrEqual(500);
    expect(b.y + b.h).toBeLessThanOrEqual(500);
  });

  it('is a no-op at factor 0', () => {
    expect(expandBox({ x: 20, y: 30, w: 40, h: 50 }, 0, 1000, 1000)).toEqual({
      x: 20,
      y: 30,
      w: 40,
      h: 50,
    });
  });
});
