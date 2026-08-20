/**
 * Pure logic for the Block Puzzle game (place-3-pieces, 8×8 board, full rows
 * and columns clear, endless, no timer). No gravity and no falling pieces —
 * an original polyomino-placement design for this genre.
 */

export type Board = number[][]; // 0 = empty, >0 = colour index
export const BOARD = 8;

export interface PieceShape {
  id: string;
  /** Occupied cells relative to the piece's top-left, as [row, col]. */
  cells: [number, number][];
  color: number;
  /** Relative draw weight (smaller pieces are more common). */
  weight: number;
}

const P = (id: string, cells: [number, number][], color: number, weight: number): PieceShape => ({ id, cells, color, weight });

const line = (n: number, vertical: boolean): [number, number][] =>
  Array.from({ length: n }, (_, i) => (vertical ? [i, 0] : [0, i]) as [number, number]);

export const PIECES: PieceShape[] = [
  P('dot', [[0, 0]], 1, 3),
  P('h2', line(2, false), 2, 3), P('v2', line(2, true), 2, 3),
  P('h3', line(3, false), 3, 3), P('v3', line(3, true), 3, 3),
  P('h4', line(4, false), 4, 2), P('v4', line(4, true), 4, 2),
  P('h5', line(5, false), 5, 1), P('v5', line(5, true), 5, 1),
  P('sq2', [[0, 0], [0, 1], [1, 0], [1, 1]], 6, 3),
  P('sq3', [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], 7, 1),
  // Small 3-cell corners (4 orientations).
  P('c1', [[0, 0], [1, 0], [1, 1]], 8, 2),
  P('c2', [[0, 0], [0, 1], [1, 0]], 8, 2),
  P('c3', [[0, 0], [0, 1], [1, 1]], 8, 2),
  P('c4', [[0, 1], [1, 0], [1, 1]], 8, 2),
  // Big 5-cell corners (4 orientations).
  P('L1', [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], 9, 1),
  P('L2', [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], 9, 1),
  P('L3', [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], 9, 1),
  P('L4', [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]], 9, 1),
];

export function emptyBoard(): Board {
  return Array.from({ length: BOARD }, () => Array<number>(BOARD).fill(0));
}

/** Can the piece's cells be placed with its top-left anchor at (r, c)? */
export function canPlace(board: Board, piece: PieceShape, r: number, c: number): boolean {
  for (const [dr, dc] of piece.cells) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= BOARD || cc >= BOARD) return false;
    if (board[rr][cc] !== 0) return false;
  }
  return true;
}

/** Does the piece fit anywhere on the board? */
export function anyPlacement(board: Board, piece: PieceShape): boolean {
  for (let r = 0; r < BOARD; r++)
    for (let c = 0; c < BOARD; c++)
      if (canPlace(board, piece, r, c)) return true;
  return false;
}

/** Game over when none of the remaining pieces fits anywhere. */
export function isGameOver(board: Board, hand: PieceShape[]): boolean {
  return hand.length > 0 && hand.every((p) => !anyPlacement(board, p));
}

export interface PlaceResult {
  board: Board;
  /** Number of full lines (rows + columns) cleared by this placement. */
  lines: number;
  /** Points scored: cells placed + 10/line + a multi-line bonus. */
  points: number;
  /** Cells that were cleared (for the flash animation). */
  cleared: [number, number][];
}

/** Place a piece (must be valid), clear full rows/columns, and score it. */
export function placeAndClear(board: Board, piece: PieceShape, r: number, c: number): PlaceResult {
  const next = board.map((row) => [...row]);
  for (const [dr, dc] of piece.cells) next[r + dr][c + dc] = piece.color;

  const fullRows: number[] = [];
  const fullCols: number[] = [];
  for (let i = 0; i < BOARD; i++) {
    if (next[i].every((v) => v !== 0)) fullRows.push(i);
    if (next.every((row) => row[i] !== 0)) fullCols.push(i);
  }

  const cleared: [number, number][] = [];
  for (const row of fullRows) for (let i = 0; i < BOARD; i++) cleared.push([row, i]);
  for (const col of fullCols) for (let i = 0; i < BOARD; i++) if (!fullRows.includes(i)) cleared.push([i, col]);
  for (const [rr, cc] of cleared) next[rr][cc] = 0;

  const lines = fullRows.length + fullCols.length;
  const points = piece.cells.length + lines * 10 + (lines > 1 ? (lines - 1) * 10 : 0);
  return { board: next, lines, points, cleared };
}

/** Draw a hand of 3 weighted-random pieces (rng: () => [0,1)). */
export function drawHand(rng: () => number = Math.random): PieceShape[] {
  const total = PIECES.reduce((s, p) => s + p.weight, 0);
  const pick = (): PieceShape => {
    let x = rng() * total;
    for (const p of PIECES) {
      x -= p.weight;
      if (x < 0) return p;
    }
    return PIECES[0];
  };
  return [pick(), pick(), pick()];
}

/** Piece bounding size (rows, cols) — for rendering the tray. */
export function pieceSize(piece: PieceShape): [number, number] {
  let mr = 0;
  let mc = 0;
  for (const [r, c] of piece.cells) { if (r > mr) mr = r; if (c > mc) mc = c; }
  return [mr + 1, mc + 1];
}
