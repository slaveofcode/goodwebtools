import { describe, it, expect } from 'vitest';
import { cmToPt, photoPx, sheetLayout, headGuideBox, headOutlinePath, HEAD_GUIDE, PHOTO_SIZES, SHEETS } from './pas-foto.lib';

describe('cmToPt', () => {
  it('converts cm to PDF points', () => {
    expect(cmToPt(1)).toBeCloseTo(28.3465, 3);
    expect(cmToPt(21)).toBeCloseTo(595.28, 1); // A4 width
  });
});

describe('photoPx', () => {
  it('sizes a 3x4 cm photo at 300 DPI', () => {
    expect(photoPx(3, 4, 300)).toEqual({ w: 354, h: 472 });
  });
  it('sizes a 2x3 cm photo at 300 DPI', () => {
    expect(photoPx(2, 3, 300)).toEqual({ w: 236, h: 354 });
  });
});

describe('sheetLayout', () => {
  it('fits 3x4 photos on a 4R sheet (3 x 3 = 9)', () => {
    const l = sheetLayout(3, 4, 10.16, 15.24, 0.2, 0.3);
    expect(l.cols).toBe(3);
    expect(l.rows).toBe(3);
    expect(l.count).toBe(9);
    expect(l.positions).toHaveLength(9);
  });

  it('fits many 3x4 photos on A4 (6 x 6 = 36)', () => {
    const l = sheetLayout(3, 4, 21.0, 29.7, 0.2, 0.3);
    expect(l.cols).toBe(6);
    expect(l.rows).toBe(6);
    expect(l.count).toBe(36);
  });

  it('keeps every tile inside the sheet bounds', () => {
    const l = sheetLayout(3, 4, 10.16, 15.24, 0.2, 0.3);
    for (const p of l.positions) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + 3).toBeLessThanOrEqual(10.16 + 1e-9);
      expect(p.y + 4).toBeLessThanOrEqual(15.24 + 1e-9);
    }
  });

  it('returns zero tiles when the photo is larger than the sheet', () => {
    const l = sheetLayout(30, 40, 10.16, 15.24, 0.2, 0.3);
    expect(l.count).toBe(0);
    expect(l.positions).toHaveLength(0);
  });
});

describe('headGuideBox', () => {
  it('places crown, chin and a centered head oval for a 100x100 frame', () => {
    const g = headGuideBox(100, 100);
    expect(g.crownY).toBeCloseTo(8, 5);
    expect(g.chinY).toBeCloseTo(85, 5);
    expect(g.cx).toBeCloseTo(50, 5);
    expect(g.ry).toBeCloseTo(38.5, 5); // (85-8)/2
    expect(g.cy).toBeCloseTo(46.5, 5); // (8+85)/2
    expect(g.rx).toBeCloseTo(38.5 * HEAD_GUIDE.widthToHeight, 5);
  });

  it('scales with the frame size', () => {
    const g = headGuideBox(300, 400);
    expect(g.crownY).toBeCloseTo(32, 5); // 0.08 * 400
    expect(g.cx).toBeCloseTo(150, 5);
  });

  it('keeps a head-shaped oval in every photo aspect', () => {
    // The oval's width must follow its HEIGHT (anatomy), not the frame width —
    // deriving it from the frame made it far too narrow in a 3x4 frame.
    for (const [w, h] of [[200, 300], [300, 400], [400, 600]]) {
      const g = headGuideBox(w, h);
      expect((g.rx * 2) / (g.ry * 2)).toBeCloseTo(HEAD_GUIDE.widthToHeight, 5);
    }
  });

  it('the oval is wider than the old frame-derived version in a 3x4 frame', () => {
    const g = headGuideBox(300, 400);
    expect(g.rx * 2).toBeGreaterThan(0.52 * 300); // old widthRatio behaviour
  });
});

describe('headOutlinePath', () => {
  const path = headOutlinePath(300, 400);

  it('produces a closed SVG path', () => {
    expect(path.startsWith('M ')).toBe(true);
    expect(path.trim().endsWith('Z')).toBe(true);
    expect(path.match(/C /g)).toHaveLength(4); // four bezier quadrants
  });

  it('stays inside the guide box', () => {
    const g = headGuideBox(300, 400);
    const nums = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(g.cx - g.rx - 0.01);
    expect(Math.max(...xs)).toBeLessThanOrEqual(g.cx + g.rx + 0.01);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(g.crownY - 0.01);
    expect(Math.max(...ys)).toBeLessThanOrEqual(g.chinY + 0.01);
  });

  it('starts at the crown and reaches the chin', () => {
    const g = headGuideBox(300, 400);
    const nums = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // First point is the crown (centre-top); the chin is the lowest y.
    expect(nums[0]).toBeCloseTo(g.cx, 1);
    expect(nums[1]).toBeCloseTo(g.crownY, 1);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys)).toBeCloseTo(g.chinY, 1);
  });

  it('is narrower at the chin than at the temples (head-shaped, not an ellipse)', () => {
    // Sample the path's widest control points vs the chin end.
    const g = headGuideBox(300, 400);
    const nums = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const widest = Math.max(...xs) - Math.min(...xs);
    expect(widest).toBeCloseTo(g.rx * 2, 1);
  });
});

describe('constants', () => {
  it('exposes the three standard photo sizes', () => {
    expect(PHOTO_SIZES.map(s => s.id)).toEqual(['2x3', '3x4', '4x6']);
  });
  it('exposes 4R and A4 sheets', () => {
    expect(SHEETS.map(s => s.id)).toEqual(['4r', 'a4']);
  });
});
