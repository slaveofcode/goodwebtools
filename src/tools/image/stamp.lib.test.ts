import { describe, it, expect } from 'vitest';
import {
  STAMP_PRESETS,
  fontStackFor,
  stampFontScale,
  stampGeometry,
} from './stamp.lib';

describe('fontStackFor', () => {
  it('maps each family to a stack containing the expected generic', () => {
    expect(fontStackFor('sans')).toMatch(/sans-serif/);
    expect(fontStackFor('serif')).toMatch(/serif/);
    expect(fontStackFor('mono')).toMatch(/monospace/);
    expect(fontStackFor('condensed').toLowerCase()).toMatch(/narrow|condensed/);
  });
});

describe('stampFontScale', () => {
  it('maps 1% to ~1/16 and 100% to 1/3', () => {
    expect(stampFontScale(1)).toBeCloseTo(1 / 16, 5);
    expect(stampFontScale(100)).toBeCloseTo(1 / 3, 5);
  });
  it('is monotonic and clamps out of range', () => {
    expect(stampFontScale(20)).toBeLessThan(stampFontScale(80));
    expect(stampFontScale(0)).toBe(stampFontScale(1));
    expect(stampFontScale(200)).toBe(stampFontScale(100));
  });
});

describe('STAMP_PRESETS', () => {
  it('ships the ten labels, each with a valid hex color', () => {
    const labels = STAMP_PRESETS.map(p => p.label);
    for (const l of ['Confidential', 'Paid', 'Draft', 'Approved', 'Void', 'Urgent', 'Copy', 'Original', 'Sample', 'For Review']) {
      expect(labels).toContain(l);
    }
    for (const p of STAMP_PRESETS) {
      expect(p.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('stampGeometry', () => {
  const base = { canvasW: 1000, canvasH: 800, textW: 200, fontSize: 100 };
  const padding = 100 * 0.4;
  const boxW = 200 + padding * 2; // 280
  const boxH = 100 + padding * 2; // 180

  it('centers with a -20deg rotation for the center placement', () => {
    const g = stampGeometry({ ...base, placement: 'center' });
    expect(g.cx).toBe(500);
    expect(g.cy).toBe(400);
    expect(g.rotation).toBeCloseTo(-Math.PI / 9, 5); // -20deg
    expect(g.boxW).toBeCloseTo(boxW, 5);
    expect(g.boxH).toBeCloseTo(boxH, 5);
  });

  it('places corners inset by the margin, upright (no rotation)', () => {
    const margin = 100 * 0.6; // 60
    const tl = stampGeometry({ ...base, placement: 'top-left' });
    expect(tl.cx).toBeCloseTo(margin + boxW / 2, 5);
    expect(tl.cy).toBeCloseTo(margin + boxH / 2, 5);
    expect(tl.rotation).toBe(0);

    const br = stampGeometry({ ...base, placement: 'bottom-right' });
    expect(br.cx).toBeCloseTo(1000 - margin - boxW / 2, 5);
    expect(br.cy).toBeCloseTo(800 - margin - boxH / 2, 5);

    const tr = stampGeometry({ ...base, placement: 'top-right' });
    expect(tr.cx).toBeCloseTo(1000 - margin - boxW / 2, 5);
    expect(tr.cy).toBeCloseTo(margin + boxH / 2, 5);

    const bl = stampGeometry({ ...base, placement: 'bottom-left' });
    expect(bl.cx).toBeCloseTo(margin + boxW / 2, 5);
    expect(bl.cy).toBeCloseTo(800 - margin - boxH / 2, 5);
  });
});
