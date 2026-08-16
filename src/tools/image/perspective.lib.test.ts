import { describe, it, expect } from 'vitest';
import { computeHomography, applyHomography, type Point } from './perspective.lib';

const unit: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

describe('computeHomography / applyHomography', () => {
  it('identity maps a unit square to itself', () => {
    const H = computeHomography(unit, unit);
    const [x, y] = applyHomography(H, 0.5, 0.5);
    expect(x).toBeCloseTo(0.5, 6);
    expect(y).toBeCloseTo(0.5, 6);
  });

  it('scales a unit square to a 2× square', () => {
    const dst: Point[] = [[0, 0], [2, 0], [2, 2], [0, 2]];
    const H = computeHomography(unit, dst);
    const [x, y] = applyHomography(H, 0.5, 0.5);
    expect(x).toBeCloseTo(1, 6);
    expect(y).toBeCloseTo(1, 6);
  });

  it('translates', () => {
    const dst: Point[] = [[10, 20], [11, 20], [11, 21], [10, 21]];
    const H = computeHomography(unit, dst);
    const [x, y] = applyHomography(H, 0, 0);
    expect(x).toBeCloseTo(10, 6);
    expect(y).toBeCloseTo(20, 6);
  });

  it('maps corners exactly for a projective (trapezoid) target', () => {
    const dst: Point[] = [[0, 0], [100, 10], [90, 80], [5, 95]];
    const H = computeHomography(unit, dst);
    unit.forEach((src, i) => {
      const [x, y] = applyHomography(H, src[0], src[1]);
      expect(x).toBeCloseTo(dst[i][0], 4);
      expect(y).toBeCloseTo(dst[i][1], 4);
    });
  });
});
