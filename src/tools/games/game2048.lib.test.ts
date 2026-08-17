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
