import { describe, it, expect } from 'vitest';
import { gridLayout } from './collage.lib';

describe('gridLayout', () => {
  it('places a 2×2 grid with even gaps', () => {
    const cells = gridLayout(4, 2, 420, 420, 20);
    // cellW = (420 - 20*3)/2 = 180
    expect(cells).toHaveLength(4);
    expect(cells[0]).toEqual({ index: 0, x: 20, y: 20, w: 180, h: 180 });
    expect(cells[1]).toMatchObject({ x: 220, y: 20 });
    expect(cells[2]).toMatchObject({ x: 20, y: 220 });
    expect(cells[3]).toMatchObject({ x: 220, y: 220 });
  });

  it('handles a partial last row (uniform cell size)', () => {
    const cells = gridLayout(3, 2, 420, 420, 20); // 2 cols, 2 rows
    expect(cells).toHaveLength(3);
    expect(cells[0].h).toBeCloseTo(180, 5);
    expect(cells[2]).toMatchObject({ x: 20 }); // starts a new row
  });

  it('returns empty for non-positive inputs', () => {
    expect(gridLayout(0, 2, 100, 100, 10)).toEqual([]);
    expect(gridLayout(4, 0, 100, 100, 10)).toEqual([]);
  });
});
