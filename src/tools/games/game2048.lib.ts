/**
 * Pure 2048 game logic: sliding/merging, move application in any direction,
 * board helpers and a simple look-ahead "cheat" AI. The board is a 4×4 grid of
 * numbers (0 = empty). Randomness (spawning tiles) lives in the island.
 */

export type Grid = number[][];
export type Direction = 'left' | 'right' | 'up' | 'down';
export const SIZE = 4;

export interface SlideResult { line: number[]; gained: number; moved: boolean; }

/** Slide and merge a single line toward index 0 (i.e. "left"). */
export function slideLine(line: number[]): SlideResult {
  const nonzero = line.filter(v => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < nonzero.length; i++) {
    if (i + 1 < nonzero.length && nonzero[i] === nonzero[i + 1]) {
      const merged = nonzero[i] * 2;
      out.push(merged);
      gained += merged;
      i++; // consume the pair
    } else {
      out.push(nonzero[i]);
    }
  }
  while (out.length < line.length) out.push(0);
  const moved = out.some((v, i) => v !== line[i]);
  return { line: out, gained, moved };
}

const clone = (g: Grid): Grid => g.map(r => [...r]);
const transpose = (g: Grid): Grid => g[0].map((_, c) => g.map(r => r[c]));
const reverseRows = (g: Grid): Grid => g.map(r => [...r].reverse());

export interface MoveResult { grid: Grid; gained: number; moved: boolean; }

/** Apply a move in the given direction. Returns a new grid (input unchanged). */
export function move(grid: Grid, dir: Direction): MoveResult {
  let work = clone(grid);
  if (dir === 'right') work = reverseRows(work);
  else if (dir === 'up') work = transpose(work);
  else if (dir === 'down') work = reverseRows(transpose(work));

  let gained = 0;
  let moved = false;
  work = work.map(row => {
    const r = slideLine(row);
    gained += r.gained;
    if (r.moved) moved = true;
    return r.line;
  });

  if (dir === 'right') work = reverseRows(work);
  else if (dir === 'up') work = transpose(work);
  else if (dir === 'down') work = transpose(reverseRows(work));

  return { grid: work, gained, moved };
}

export function emptyCells(grid: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c] === 0) cells.push([r, c]);
  return cells;
}

export function maxTile(grid: Grid): number {
  let m = 0;
  for (const row of grid) for (const v of row) if (v > m) m = v;
  return m;
}

const DIRECTIONS: Direction[] = ['down', 'left', 'right', 'up'];

export function hasMoves(grid: Grid): boolean {
  return DIRECTIONS.some(d => move(grid, d).moved);
}

/** Empty grid of the standard size. */
export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
}

/** Heuristic score for a board: prefer empty cells, big merges and a corner max. */
function score(grid: Grid, gained: number): number {
  const empties = emptyCells(grid).length;
  const max = maxTile(grid);
  // Bonus if the max tile sits in a corner (keeps the board organised).
  const corners = [grid[0][0], grid[0][SIZE - 1], grid[SIZE - 1][0], grid[SIZE - 1][SIZE - 1]];
  const cornerBonus = corners.includes(max) ? max : 0;
  return empties * 128 + gained + cornerBonus;
}

/**
 * Cheat / auto-play AI: pick the legal move that leaves the best board by a
 * shallow one-ply heuristic. Returns null when no move is possible.
 */
export function bestMove(grid: Grid): Direction | null {
  let best: Direction | null = null;
  let bestScore = -Infinity;
  for (const dir of DIRECTIONS) {
    const r = move(grid, dir);
    if (!r.moved) continue;
    const s = score(r.grid, r.gained);
    if (s > bestScore) { bestScore = s; best = dir; }
  }
  return best;
}
