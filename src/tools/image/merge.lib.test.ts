import { describe, expect, it } from 'vitest';
import { computeMergeLayout, type MergeOptions } from './merge.lib';

const opts = (over: Partial<MergeOptions> = {}): MergeOptions => ({
  direction: 'vertical',
  gap: 0,
  background: '#ffffff',
  match: false,
  ...over,
});

describe('computeMergeLayout', () => {
  it('returns an empty layout for no images', () => {
    expect(computeMergeLayout([], opts())).toEqual({ width: 0, height: 0, placements: [] });
  });

  it('stacks vertically: canvas width = widest, height = sum of heights', () => {
    const l = computeMergeLayout([{ width: 100, height: 40 }, { width: 60, height: 30 }], opts());
    expect(l.width).toBe(100);
    expect(l.height).toBe(70);
    expect(l.placements[0]).toEqual({ x: 0, y: 0, w: 100, h: 40 });
    // narrower image is centered horizontally
    expect(l.placements[1]).toEqual({ x: 20, y: 40, w: 60, h: 30 });
  });

  it('adds gaps between stacked images', () => {
    const l = computeMergeLayout([{ width: 50, height: 20 }, { width: 50, height: 20 }], opts({ gap: 10 }));
    expect(l.height).toBe(50); // 20 + 10 + 20
    expect(l.placements[1].y).toBe(30);
  });

  it('matches widths when requested, scaling heights proportionally', () => {
    // common width = min = 50; second image 100x40 -> 50x20
    const l = computeMergeLayout([{ width: 50, height: 30 }, { width: 100, height: 40 }], opts({ match: true }));
    expect(l.width).toBe(50);
    expect(l.placements[0]).toEqual({ x: 0, y: 0, w: 50, h: 30 });
    expect(l.placements[1]).toEqual({ x: 0, y: 30, w: 50, h: 20 });
    expect(l.height).toBe(50);
  });

  it('lays out horizontally: canvas height = tallest, width = sum of widths', () => {
    const l = computeMergeLayout([{ width: 40, height: 100 }, { width: 30, height: 60 }], opts({ direction: 'horizontal' }));
    expect(l.height).toBe(100);
    expect(l.width).toBe(70);
    expect(l.placements[0]).toEqual({ x: 0, y: 0, w: 40, h: 100 });
    // shorter image is centered vertically
    expect(l.placements[1]).toEqual({ x: 40, y: 20, w: 30, h: 60 });
  });

  it('matches heights horizontally when requested', () => {
    // common height = min = 60; first 40x120 -> 20x60
    const l = computeMergeLayout([{ width: 40, height: 120 }, { width: 30, height: 60 }], opts({ direction: 'horizontal', match: true }));
    expect(l.height).toBe(60);
    expect(l.placements[0]).toEqual({ x: 0, y: 0, w: 20, h: 60 });
    expect(l.placements[1]).toEqual({ x: 20, y: 0, w: 30, h: 60 });
    expect(l.width).toBe(50);
  });
});
