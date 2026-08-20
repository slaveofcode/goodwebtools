import { describe, it, expect } from 'vitest';
import { BOARD, PIECES, emptyBoard, canPlace, anyPlacement, isGameOver, placeAndClear, drawHand, pieceSize } from './blocks.lib';

const pieceById = (id: string) => PIECES.find((p) => p.id === id)!;

describe('blocks board', () => {
  it('starts empty', () => {
    const b = emptyBoard();
    expect(b).toHaveLength(BOARD);
    expect(b.flat().every((v) => v === 0)).toBe(true);
  });

  it('canPlace respects bounds', () => {
    const b = emptyBoard();
    const h5 = pieceById('h5');
    expect(canPlace(b, h5, 0, 0)).toBe(true);
    expect(canPlace(b, h5, 0, 3)).toBe(true);   // cols 3..7
    expect(canPlace(b, h5, 0, 4)).toBe(false);  // col 8 out of bounds
    expect(canPlace(b, pieceById('sq3'), 6, 6)).toBe(false);
  });

  it('canPlace respects occupied cells', () => {
    const b = emptyBoard();
    b[0][1] = 3;
    expect(canPlace(b, pieceById('h2'), 0, 0)).toBe(false);
    expect(canPlace(b, pieceById('h2'), 1, 0)).toBe(true);
  });

  it('placeAndClear fills cells with the piece colour and scores cells placed', () => {
    const r = placeAndClear(emptyBoard(), pieceById('sq2'), 2, 2);
    expect(r.board[2][2]).toBe(pieceById('sq2').color);
    expect(r.board[3][3]).toBe(pieceById('sq2').color);
    expect(r.lines).toBe(0);
    expect(r.points).toBe(4); // 4 cells, no lines
    expect(r.cleared).toEqual([]);
  });

  it('clears a full row', () => {
    const b = emptyBoard();
    for (let c = 0; c < BOARD - 1; c++) b[4][c] = 1; // row 4 missing last cell
    const r = placeAndClear(b, pieceById('dot'), 4, 7);
    expect(r.lines).toBe(1);
    expect(r.board[4].every((v) => v === 0)).toBe(true);
    expect(r.points).toBe(1 + 10);
    expect(r.cleared).toHaveLength(BOARD);
  });

  it('clears a row and a column simultaneously with a multi-line bonus', () => {
    const b = emptyBoard();
    for (let c = 0; c < BOARD - 1; c++) b[0][c] = 1; // row 0 missing (0,7)
    for (let r2 = 1; r2 < BOARD; r2++) b[r2][7] = 2; // col 7 missing (0,7)
    const r = placeAndClear(b, pieceById('dot'), 0, 7);
    expect(r.lines).toBe(2);
    expect(r.board[0].every((v) => v === 0)).toBe(true);
    expect(r.board.every((row) => row[7] === 0)).toBe(true);
    // Intersection cell counted once in the cleared list.
    expect(r.cleared).toHaveLength(BOARD * 2 - 1);
    expect(r.points).toBe(1 + 20 + 10);
  });

  it('cells outside cleared lines survive', () => {
    const b = emptyBoard();
    for (let c = 0; c < BOARD - 1; c++) b[4][c] = 1;
    b[5][0] = 6;
    const r = placeAndClear(b, pieceById('dot'), 4, 7);
    expect(r.board[5][0]).toBe(6);
  });

  it('anyPlacement / isGameOver', () => {
    const b = emptyBoard();
    // Fill everything except one cell.
    for (let r = 0; r < BOARD; r++) for (let c = 0; c < BOARD; c++) b[r][c] = 1;
    b[0][0] = 0;
    expect(anyPlacement(b, pieceById('dot'))).toBe(true);
    expect(anyPlacement(b, pieceById('h2'))).toBe(false);
    expect(isGameOver(b, [pieceById('h2'), pieceById('sq2')])).toBe(true);
    expect(isGameOver(b, [pieceById('h2'), pieceById('dot')])).toBe(false);
  });

  it('drawHand returns 3 pieces deterministically for a fixed rng', () => {
    let calls = 0;
    const rng = () => [0.01, 0.5, 0.99][calls++ % 3];
    const hand = drawHand(rng);
    expect(hand).toHaveLength(3);
    expect(hand[0].id).toBe('dot');           // near-zero roll → first piece
    expect(PIECES).toContain(hand[1]);
    expect(PIECES).toContain(hand[2]);
  });

  it('pieceSize computes bounding boxes', () => {
    expect(pieceSize(pieceById('h5'))).toEqual([1, 5]);
    expect(pieceSize(pieceById('v3'))).toEqual([3, 1]);
    expect(pieceSize(pieceById('sq3'))).toEqual([3, 3]);
    expect(pieceSize(pieceById('L1'))).toEqual([3, 3]);
  });

  it('every piece fits on an empty board', () => {
    const b = emptyBoard();
    expect(PIECES.every((p) => anyPlacement(b, p))).toBe(true);
  });
});
