/**
 * Pure logic for the Onet / connect tile-matching game.
 *
 * Two identical tiles clear when a path joins them using at most three straight
 * segments (i.e. at most two turns) through empty cells. The path may leave the
 * board through a one-cell margin all around — that border route is what makes
 * edge tiles matchable and is the classic source of "why won't these match?".
 *
 * Grids are `Cell[][]` indexed [row][col]; 0 means empty.
 */

export type Cell = number; // 0 = empty, >0 = tile symbol id
export type Grid = Cell[][];
export interface Pos { r: number; c: number }
export type Rng = () => number;

export interface Difficulty { id: string; cols: number; rows: number; symbols: number }

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', cols: 6, rows: 8, symbols: 12 },
  { id: 'normal', cols: 8, rows: 10, symbols: 18 },
  { id: 'hard', cols: 10, rows: 12, symbols: 24 },
];

export const posEq = (a: Pos, b: Pos): boolean => a.r === b.r && a.c === b.c;

/** Tiles remaining on the board. */
export function tilesLeft(grid: Grid): number {
  let n = 0;
  for (const row of grid) for (const v of row) if (v !== 0) n++;
  return n;
}

export const isSolved = (grid: Grid): boolean => tilesLeft(grid) === 0;

/**
 * Is (r, c) walkable? The board is padded by one cell on every side, so
 * coordinates from -1..rows and -1..cols are valid; anything in the margin is
 * always walkable, and inside cells are walkable only when empty.
 */
function walkable(grid: Grid, r: number, c: number): boolean {
  const rows = grid.length;
  const cols = grid[0].length;
  if (r < -1 || c < -1 || r > rows || c > cols) return false;
  if (r === -1 || c === -1 || r === rows || c === cols) return true; // margin
  return grid[r][c] === 0;
}

const DIRS: Pos[] = [{ r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }];

/**
 * Find a connecting path between two matching tiles, or null.
 * Returns the corner points (start → turns → end) so the UI can draw the line.
 */
export function findPath(grid: Grid, a: Pos, b: Pos): Pos[] | null {
  if (posEq(a, b)) return null;
  const rows = grid.length;
  const cols = grid[0].length;
  const inside = (p: Pos) => p.r >= 0 && p.c >= 0 && p.r < rows && p.c < cols;
  if (!inside(a) || !inside(b)) return null;
  const symbol = grid[a.r][a.c];
  if (symbol === 0 || grid[b.r][b.c] !== symbol) return null;

  // BFS over (cell, incoming direction, turns used). Keeping the best (lowest)
  // turn count per (cell, direction) is enough — a cheaper arrival is never worse.
  const key = (r: number, c: number, d: number) => `${r},${c},${d}`;
  const best = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const queue: { r: number; c: number; d: number; turns: number }[] = [];

  for (let d = 0; d < DIRS.length; d++) {
    const nr = a.r + DIRS[d].r;
    const nc = a.c + DIRS[d].c;
    // The destination itself is a tile (not empty), so allow stepping onto it.
    if (!walkable(grid, nr, nc) && !(nr === b.r && nc === b.c)) continue;
    const k = key(nr, nc, d);
    best.set(k, 0);
    prev.set(k, null);
    queue.push({ r: nr, c: nc, d, turns: 0 });
  }

  let endKey: string | null = null;
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur.r === b.r && cur.c === b.c) { endKey = key(cur.r, cur.c, cur.d); break; }
    // Can't travel THROUGH a tile — only stop on the target.
    if (!walkable(grid, cur.r, cur.c)) continue;
    for (let d = 0; d < DIRS.length; d++) {
      const turns = cur.turns + (d === cur.d ? 0 : 1);
      if (turns > 2) continue;
      const nr = cur.r + DIRS[d].r;
      const nc = cur.c + DIRS[d].c;
      const isTarget = nr === b.r && nc === b.c;
      if (!walkable(grid, nr, nc) && !isTarget) continue;
      const k = key(nr, nc, d);
      const known = best.get(k);
      if (known !== undefined && known <= turns) continue;
      best.set(k, turns);
      prev.set(k, key(cur.r, cur.c, cur.d));
      queue.push({ r: nr, c: nc, d, turns });
    }
  }

  if (!endKey) return null;

  // Walk the chain back, then keep only the corner points.
  const chain: Pos[] = [];
  let k: string | null = endKey;
  while (k) {
    const [r, c] = k.split(',').map(Number);
    chain.push({ r, c });
    k = prev.get(k) ?? null;
  }
  chain.push({ r: a.r, c: a.c });
  chain.reverse();
  return simplifyPath(chain);
}

/** Drop collinear midpoints so only the start, turns and end remain. */
export function simplifyPath(points: Pos[]): Pos[] {
  if (points.length <= 2) return points;
  const out: Pos[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    const straight = (a.r === b.r && b.r === c.r) || (a.c === b.c && b.c === c.c);
    if (!straight) out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
}

export const canConnect = (grid: Grid, a: Pos, b: Pos): boolean => findPath(grid, a, b) !== null;

/** First connectable pair on the board, or null when the player is stuck. */
export function findHint(grid: Grid): [Pos, Pos] | null {
  const spots: Pos[] = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c] !== 0) spots.push({ r, c });

  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      if (grid[spots[i].r][spots[i].c] !== grid[spots[j].r][spots[j].c]) continue;
      if (canConnect(grid, spots[i], spots[j])) return [spots[i], spots[j]];
    }
  }
  return null;
}

export const hasAnyMove = (grid: Grid): boolean => findHint(grid) !== null;

/** Remove a matched pair (returns a new grid). */
export function removePair(grid: Grid, a: Pos, b: Pos): Grid {
  const next = grid.map((row) => [...row]);
  next[a.r][a.c] = 0;
  next[b.r][b.c] = 0;
  return next;
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Re-deal the remaining tiles into their existing cells. */
function redeal(grid: Grid, rng: Rng): Grid {
  const spots: Pos[] = [];
  const values: number[] = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c] !== 0) { spots.push({ r, c }); values.push(grid[r][c]); }

  const mixed = shuffled(values, rng);
  const next = grid.map((row) => row.map(() => 0));
  spots.forEach((p, i) => { next[p.r][p.c] = mixed[i]; });
  return next;
}

/**
 * Shuffle the remaining tiles, retrying until the result has at least one legal
 * move so the player is never handed a dead board.
 */
export function shuffleBoard(grid: Grid, rng: Rng = Math.random, maxTries = 40): Grid {
  if (tilesLeft(grid) === 0) return grid;
  let last = grid;
  for (let i = 0; i < maxTries; i++) {
    last = redeal(grid, rng);
    if (hasAnyMove(last)) return last;
  }
  return last;
}

/**
 * Deal a new board. Cell count must be even; each symbol is placed in pairs, so
 * the board always has an even number of every tile. Retries until the opening
 * position has a legal move.
 */
export function createBoard(d: Difficulty, rng: Rng = Math.random, maxTries = 40): Grid {
  const total = d.cols * d.rows;
  if (total % 2 !== 0) throw new Error('Board must have an even number of cells');
  const values: number[] = [];
  for (let i = 0; i < total / 2; i++) {
    const symbol = (i % d.symbols) + 1;
    values.push(symbol, symbol);
  }
  for (let i = 0; i < maxTries; i++) {
    const mixed = shuffled(values, rng);
    const grid: Grid = [];
    for (let r = 0; r < d.rows; r++) grid.push(mixed.slice(r * d.cols, (r + 1) * d.cols));
    if (hasAnyMove(grid)) return grid;
  }
  // Extremely unlikely; the caller can still shuffle.
  const mixed = shuffled(values, rng);
  const grid: Grid = [];
  for (let r = 0; r < d.rows; r++) grid.push(mixed.slice(r * d.cols, (r + 1) * d.cols));
  return grid;
}

/** Score for clearing a pair: base points plus a small streak bonus. */
export function pairScore(streak: number): number {
  return 10 + Math.min(40, Math.max(0, streak - 1) * 5);
}
