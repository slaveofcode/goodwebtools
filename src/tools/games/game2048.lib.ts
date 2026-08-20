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

/* ------------------------------------------------------------------ *
 * Identity-tracked tiles: the same board logic, but each tile keeps a
 * stable id across moves so the UI can animate slides (CSS transforms),
 * merge pops and spawns — like the original game.
 * ------------------------------------------------------------------ */

export interface Tile {
  id: number;
  value: number;
  r: number;
  c: number;
  /** Set on the move that created it (spawn pop-in animation). */
  isNew?: boolean;
  /** Set on the move that merged it (pop animation). */
  justMerged?: boolean;
}

/** A swallowed tile rendered one frame at the merge target so it slides too. */
export interface Ghost { id: number; value: number; r: number; c: number }

export interface TilesMoveResult {
  tiles: Tile[];
  ghosts: Ghost[];
  gained: number;
  moved: boolean;
}

/** Cells of one line in slide order for a direction (index 0 = slide target). */
function lineCells(line: number, dir: Direction): [number, number][] {
  const cells: [number, number][] = [];
  for (let i = 0; i < SIZE; i++) {
    if (dir === 'left') cells.push([line, i]);
    else if (dir === 'right') cells.push([line, SIZE - 1 - i]);
    else if (dir === 'up') cells.push([i, line]);
    else cells.push([SIZE - 1 - i, line]);
  }
  return cells;
}

/** Apply a move to identity-tracked tiles. Pure — inputs unchanged. */
export function moveTiles(tiles: Tile[], dir: Direction): TilesMoveResult {
  const at = new Map<string, Tile>();
  for (const t of tiles) at.set(`${t.r},${t.c}`, t);

  const out: Tile[] = [];
  const ghosts: Ghost[] = [];
  let gained = 0;
  let moved = false;

  for (let line = 0; line < SIZE; line++) {
    const cells = lineCells(line, dir);
    const nz = cells.map(([r, c]) => at.get(`${r},${c}`)).filter((t): t is Tile => !!t);
    let outIdx = 0;
    for (let i = 0; i < nz.length; i++) {
      const [tr, tc] = cells[outIdx];
      if (i + 1 < nz.length && nz[i].value === nz[i + 1].value) {
        // Keep the farther tile's id so the visible motion carries the merge;
        // the nearer tile becomes a ghost sliding to the same cell.
        const survivor = nz[i + 1];
        const swallowed = nz[i];
        out.push({ id: survivor.id, value: survivor.value * 2, r: tr, c: tc, justMerged: true });
        ghosts.push({ id: swallowed.id, value: swallowed.value, r: tr, c: tc });
        gained += survivor.value * 2;
        moved = true;
        i++;
      } else {
        const t = nz[i];
        if (t.r !== tr || t.c !== tc) moved = true;
        out.push({ id: t.id, value: t.value, r: tr, c: tc });
      }
      outIdx++;
    }
  }

  return { tiles: out, ghosts, gained, moved };
}

/** Project identity-tracked tiles onto a plain number grid (for the AI/checks). */
export function tilesToGrid(tiles: Tile[]): Grid {
  const g = emptyGrid();
  for (const t of tiles) g[t.r][t.c] = t.value;
  return g;
}
