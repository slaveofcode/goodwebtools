import { describe, it, expect } from 'vitest';
import { pageNumberXY, placementToPdfRect, textPlacementToPdf } from './layout.lib';

describe('pageNumberXY', () => {
  it('places bottom-center', () => {
    expect(pageNumberXY('bottom-center', 600, 800, 20, 12, 30)).toEqual({ x: 290, y: 30 });
  });
  it('places bottom-right', () => {
    expect(pageNumberXY('bottom-right', 600, 800, 20, 12, 30)).toEqual({ x: 550, y: 30 });
  });
  it('places top-left (y measured from bottom)', () => {
    expect(pageNumberXY('top-left', 600, 800, 20, 12, 30)).toEqual({ x: 30, y: 758 });
  });
});

describe('placementToPdfRect', () => {
  it('flips a top-left ratio placement to bottom-left coordinates', () => {
    // 50%-wide box at (10%,10% from top) on a 600×800 page, square image.
    const r = placementToPdfRect({ pageIndex: 0, xRatio: 0.1, yRatio: 0.1, wRatio: 0.5 }, 600, 800, 1);
    expect(r.width).toBe(300);
    expect(r.height).toBe(300);
    expect(r.x).toBe(60);
    // yFromTop = 80, height 300 → y = 800 - 80 - 300 = 420
    expect(r.y).toBe(420);
  });

  it('derives height from a wide image aspect', () => {
    const r = placementToPdfRect({ pageIndex: 0, xRatio: 0, yRatio: 0, wRatio: 1 }, 600, 800, 3);
    expect(r.width).toBe(600);
    expect(r.height).toBe(200);
  });
});

describe('textPlacementToPdf', () => {
  it('maps a top-left text placement to a bottom-left baseline', () => {
    const r = textPlacementToPdf(
      { pageIndex: 0, xRatio: 0.5, yRatio: 0.25, text: 'hi', sizeRatio: 0.02 },
      600, 800,
    );
    expect(r.size).toBe(16);   // 0.02 × 800
    expect(r.x).toBe(300);     // 0.5 × 600
    expect(r.y).toBe(584);     // 800 − (0.25 × 800) − 16
  });
});
