import { describe, it, expect } from 'vitest';
import { paddedCount, bookletOrder } from './booklet.lib';

describe('paddedCount', () => {
  it('rounds up to a multiple of 4', () => {
    expect(paddedCount(1)).toBe(4);
    expect(paddedCount(4)).toBe(4);
    expect(paddedCount(5)).toBe(8);
    expect(paddedCount(6)).toBe(8);
  });
  it('is 0 for no pages', () => {
    expect(paddedCount(0)).toBe(0);
  });
});

describe('bookletOrder', () => {
  it('orders a 4-page booklet for saddle-stitch', () => {
    // sheet front [4,1], back [2,3] → folds to 1,2,3,4
    expect(bookletOrder(4)).toEqual([4, 1, 2, 3]);
  });

  it('orders an 8-page booklet', () => {
    expect(bookletOrder(8)).toEqual([8, 1, 2, 7, 6, 3, 4, 5]);
  });

  it('pads with blanks (0) when not a multiple of 4', () => {
    // 6 pages → padded to 8; pages 7 and 8 become blanks (0)
    expect(bookletOrder(6)).toEqual([0, 1, 2, 0, 6, 3, 4, 5]);
  });

  it('is empty for zero pages', () => {
    expect(bookletOrder(0)).toEqual([]);
  });
});
