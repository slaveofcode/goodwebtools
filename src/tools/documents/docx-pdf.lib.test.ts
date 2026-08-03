import { describe, it, expect } from 'vitest';
import { pxToPt, pageSizePt } from './docx-pdf.lib';

describe('pxToPt', () => {
  it('converts CSS pixels to PDF points at 96 DPI', () => {
    expect(pxToPt(96)).toBe(72); // 1 inch
    expect(pxToPt(0)).toBe(0);
  });
  it('honours a custom DPI', () => {
    expect(pxToPt(150, 150)).toBe(72);
  });
});

describe('pageSizePt', () => {
  it('maps an A4 page in px (~794x1123 @96dpi) to ~595x842 pt', () => {
    const [w, h] = pageSizePt(794, 1123);
    expect(w).toBeCloseTo(595.5, 1);
    expect(h).toBeCloseTo(842.25, 1);
  });
  it('rounds to 2 decimals and preserves orientation (landscape)', () => {
    const [w, h] = pageSizePt(1123, 794);
    expect(w).toBeGreaterThan(h);
    expect(Number.isInteger(w * 100)).toBe(true); // at most 2 decimals
  });
});
