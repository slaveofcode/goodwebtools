import { describe, it, expect } from 'vitest';
import { slideLine, move, emptyCells, hasMoves, maxTile, bestMove, type Grid } from './game2048.lib';

describe('slideLine', () => {
  it('slides tiles toward index 0', () => {
    expect(slideLine([0, 2, 0, 2]).line).toEqual([4, 0, 0, 0]);
  });
  it('merges one pair and reports the gain', () => {
    const r = slideLine([2, 2, 0, 0]);
    expect(r.line).toEqual([4, 0, 0, 0]);
    expect(r.gained).toBe(4);
  });
  it('merges only the first pair of three equal tiles', () => {
    expect(slideLine([2, 2, 2, 0]).line).toEqual([4, 2, 0, 0]);
  });
  it('merges two pairs independently', () => {
    const r = slideLine([4, 4, 4, 4]);
    expect(r.line).toEqual([8, 8, 0, 0]);
    expect(r.gained).toBe(16);
  });
  it('reports no move when nothing changes', () => {
    expect(slideLine([2, 4, 8, 16]).moved).toBe(false);
  });
});

describe('move', () => {
  const g: Grid = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [4, 0, 4, 0],
    [0, 0, 0, 8],
  ];
  it('moves left', () => {
    expect(move(g, 'left').grid[0]).toEqual([4, 0, 0, 0]);
    expect(move(g, 'left').grid[2]).toEqual([8, 0, 0, 0]);
  });
  it('moves right', () => {
    expect(move(g, 'right').grid[0]).toEqual([0, 0, 0, 4]);
    expect(move(g, 'right').grid[3]).toEqual([0, 0, 0, 8]);
  });
  it('moves down (stacks a column)', () => {
    const col: Grid = [[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0]];
    expect(move(col, 'down').grid.map(r => r[0])).toEqual([0, 0, 4, 4]);
  });
  it('flags moved=false when the direction changes nothing', () => {
    const packed: Grid = [[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    expect(move(packed, 'left').moved).toBe(false);
  });
});

describe('helpers', () => {
  it('emptyCells lists blank positions', () => {
    expect(emptyCells([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]).length).toBe(15);
  });
  it('maxTile finds the largest tile', () => {
    expect(maxTile([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])).toBe(16);
  });
  it('hasMoves is false on a full, unmergeable board', () => {
    const stuck: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(hasMoves(stuck)).toBe(false);
    expect(hasMoves([[2, 2, 4, 8], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])).toBe(true);
  });
});

describe('bestMove (cheat AI)', () => {
  it('returns a direction that actually changes the board', () => {
    const g: Grid = [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const dir = bestMove(g)!;
    expect(dir).not.toBeNull();
    expect(move(g, dir).moved).toBe(true);
  });
  it('returns null when no move is possible', () => {
    const stuck: Grid = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
    expect(bestMove(stuck)).toBeNull();
  });
});

// --- Identity-tracked tiles (animation support) ---------------------------
import { moveTiles, tilesToGrid, type Tile } from './game2048.lib';

describe('moveTiles', () => {
  const T = (id: number, value: number, r: number, c: number): Tile => ({ id, value, r, c });

  it('slides a tile keeping its id', () => {
    const res = moveTiles([T(1, 2, 0, 3)], 'left');
    expect(res.moved).toBe(true);
    expect(res.tiles).toEqual([{ id: 1, value: 2, r: 0, c: 0 }]);
    expect(res.ghosts).toEqual([]);
  });

  it('merges equal tiles: survivor keeps the farther id, ghost slides to target', () => {
    const res = moveTiles([T(1, 2, 0, 0), T(2, 2, 0, 3)], 'left');
    expect(res.tiles).toEqual([{ id: 2, value: 4, r: 0, c: 0, justMerged: true }]);
    expect(res.ghosts).toEqual([{ id: 1, value: 2, r: 0, c: 0 }]);
    expect(res.gained).toBe(4);
  });

  it('merges only once per move ([2,2,2,2] → [4,4])', () => {
    const res = moveTiles([T(1, 2, 0, 0), T(2, 2, 0, 1), T(3, 2, 0, 2), T(4, 2, 0, 3)], 'left');
    expect(res.tiles.map(t => t.value)).toEqual([4, 4]);
    expect(res.tiles.map(t => [t.r, t.c])).toEqual([[0, 0], [0, 1]]);
    expect(res.ghosts).toHaveLength(2);
    expect(res.gained).toBe(8);
  });

  it('handles all four directions', () => {
    expect(moveTiles([T(1, 2, 0, 0)], 'right').tiles[0]).toMatchObject({ r: 0, c: 3 });
    expect(moveTiles([T(1, 2, 3, 2)], 'up').tiles[0]).toMatchObject({ r: 0, c: 2 });
    expect(moveTiles([T(1, 2, 0, 2)], 'down').tiles[0]).toMatchObject({ r: 3, c: 2 });
  });

  it('reports moved=false when nothing changes', () => {
    const res = moveTiles([T(1, 2, 0, 0), T(2, 4, 0, 1)], 'left');
    expect(res.moved).toBe(false);
  });

  it('clears isNew/justMerged flags on the next move', () => {
    const res = moveTiles([{ ...T(1, 2, 0, 3), isNew: true, justMerged: true }], 'left');
    expect(res.tiles[0].isNew).toBeUndefined();
    expect(res.tiles[0].justMerged).toBeUndefined();
  });

  it('agrees with the plain-grid move()', () => {
    const tiles = [T(1, 2, 0, 0), T(2, 2, 0, 1), T(3, 4, 1, 0), T(4, 8, 3, 3)];
    const viaTiles = tilesToGrid(moveTiles(tiles, 'down').tiles);
    const viaGrid = move(tilesToGrid(tiles), 'down').grid;
    expect(viaTiles).toEqual(viaGrid);
  });
});

describe('tilesToGrid', () => {
  it('projects tiles onto a grid', () => {
    const g = tilesToGrid([{ id: 1, value: 2, r: 0, c: 0 }, { id: 2, value: 8, r: 3, c: 3 }]);
    expect(g[0][0]).toBe(2);
    expect(g[3][3]).toBe(8);
    expect(g[1][1]).toBe(0);
  });
});
