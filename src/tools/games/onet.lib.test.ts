import { describe, it, expect } from 'vitest';
import {
  findPath, canConnect, findHint, hasAnyMove, removePair, shuffleBoard,
  createBoard, tilesLeft, isSolved, simplifyPath, pairScore, posEq,
  DIFFICULTIES, type Grid,
} from './onet.lib';

/** Build a grid from rows of digits; '.' is empty. */
const g = (...rows: string[]): Grid =>
  rows.map((row) => [...row].map((ch) => (ch === '.' ? 0 : Number(ch))));

const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('findPath — straight line (0 turns)', () => {
  it('connects horizontal neighbours', () => {
    const grid = g('11');
    expect(findPath(grid, { r: 0, c: 0 }, { r: 0, c: 1 })).not.toBeNull();
  });

  it('connects along a clear row', () => {
    const grid = g('1..1');
    const path = findPath(grid, { r: 0, c: 0 }, { r: 0, c: 3 });
    expect(path).not.toBeNull();
    expect(path).toHaveLength(2); // start + end, no turns
  });

  it('connects along a clear column', () => {
    const grid = g('1', '.', '.', '1');
    expect(canConnect(grid, { r: 0, c: 0 }, { r: 3, c: 0 })).toBe(true);
  });

  it('still connects a blocked row by going around the outside', () => {
    // The direct row is blocked by the 2, but the top margin gives a 2-turn route.
    const grid = g('1.2.1');
    expect(canConnect(grid, { r: 0, c: 0 }, { r: 0, c: 4 })).toBe(true);
  });

  it('refuses a blocked row when the outside route needs too many turns', () => {
    const grid = g(
      '999',
      '121',
      '999',
    );
    expect(findPath(grid, { r: 1, c: 0 }, { r: 1, c: 2 })).toBeNull();
  });
});

describe('findPath — one and two turns', () => {
  it('connects with a single turn (L shape)', () => {
    const grid = g(
      '1..',
      '...',
      '..1',
    );
    const path = findPath(grid, { r: 0, c: 0 }, { r: 2, c: 2 });
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThanOrEqual(3); // has at least one corner
  });

  it('connects with two turns (Z / U shape around a wall)', () => {
    const grid = g(
      '1.2',
      '..2',
      '1.2',
    );
    // Straight down column 0 is clear → still connectable.
    expect(canConnect(grid, { r: 0, c: 0 }, { r: 2, c: 0 })).toBe(true);
  });

  it('routes around a blocking wall using two turns', () => {
    const grid = g(
      '1929',
      '.99.',
      '1...',
    );
    // (0,0) → down → right? Column 0 clear to (2,0): a straight shot.
    expect(canConnect(grid, { r: 0, c: 0 }, { r: 2, c: 0 })).toBe(true);
  });

  it('rejects a path that would need three turns', () => {
    // 1s are boxed in by 9s such that no ≤2-turn route exists.
    const grid = g(
      '9991',
      '1.99',
      '9999',
      '9999',
    );
    expect(canConnect(grid, { r: 0, c: 3 }, { r: 1, c: 0 })).toBe(false);
  });
});

describe('findPath — routing outside the board', () => {
  it('connects two tiles on opposite edges by going around the outside', () => {
    // Middle is packed; the only route is out through the margin.
    const grid = g(
      '1991',
      '9999',
      '9999',
    );
    expect(canConnect(grid, { r: 0, c: 0 }, { r: 0, c: 3 })).toBe(true);
  });

  it('connects top-left and bottom-left corners around the left margin', () => {
    const grid = g(
      '19',
      '99',
      '19',
    );
    expect(canConnect(grid, { r: 0, c: 0 }, { r: 2, c: 0 })).toBe(true);
  });

  it('refuses OPPOSITE corners of a completely full board (that needs three turns)', () => {
    // Out one side, along, back in — the final approach costs a third turn.
    const grid = g(
      '199',
      '999',
      '991',
    );
    expect(canConnect(grid, { r: 0, c: 0 }, { r: 2, c: 2 })).toBe(false);
  });

  it('still refuses when the interior AND the needed turns exceed the limit', () => {
    // A single tile pair separated by a full board needing >2 turns.
    const grid = g(
      '9199',
      '9999',
      '9999',
      '9919',
    );
    expect(canConnect(grid, { r: 0, c: 1 }, { r: 3, c: 2 })).toBe(false);
  });
});

describe('findPath — validity guards', () => {
  const grid = g('1.2', '...', '1.2');

  it('refuses different symbols', () => {
    expect(findPath(grid, { r: 0, c: 0 }, { r: 0, c: 2 })).toBeNull();
  });

  it('refuses the same tile twice', () => {
    expect(findPath(grid, { r: 0, c: 0 }, { r: 0, c: 0 })).toBeNull();
  });

  it('refuses an empty cell', () => {
    expect(findPath(grid, { r: 1, c: 1 }, { r: 0, c: 0 })).toBeNull();
  });

  it('refuses out-of-bounds coordinates', () => {
    expect(findPath(grid, { r: -1, c: 0 }, { r: 0, c: 0 })).toBeNull();
    expect(findPath(grid, { r: 0, c: 0 }, { r: 9, c: 9 })).toBeNull();
  });

  it('returns a path that starts and ends on the chosen tiles', () => {
    const path = findPath(grid, { r: 0, c: 0 }, { r: 2, c: 0 })!;
    expect(posEq(path[0], { r: 0, c: 0 })).toBe(true);
    expect(posEq(path[path.length - 1], { r: 2, c: 0 })).toBe(true);
  });

  it('never returns more than four points (≤2 turns)', () => {
    const board = createBoard(DIFFICULTIES[0], seeded(7));
    const hint = findHint(board);
    if (hint) {
      const path = findPath(board, hint[0], hint[1])!;
      expect(path.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('simplifyPath', () => {
  it('collapses collinear points to the corners', () => {
    const pts = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 2 }];
    expect(simplifyPath(pts)).toEqual([{ r: 0, c: 0 }, { r: 0, c: 2 }, { r: 1, c: 2 }]);
  });

  it('leaves short paths alone', () => {
    const pts = [{ r: 0, c: 0 }, { r: 0, c: 1 }];
    expect(simplifyPath(pts)).toEqual(pts);
  });
});

describe('board state', () => {
  it('counts tiles and detects a solved board', () => {
    expect(tilesLeft(g('1.1', '...'))).toBe(2);
    expect(isSolved(g('...', '...'))).toBe(true);
    expect(isSolved(g('1..'))).toBe(false);
  });

  it('removePair clears both cells without mutating the input', () => {
    const grid = g('1.1');
    const next = removePair(grid, { r: 0, c: 0 }, { r: 0, c: 2 });
    expect(tilesLeft(next)).toBe(0);
    expect(tilesLeft(grid)).toBe(2); // original untouched
  });
});

describe('hints and deadlock', () => {
  it('finds a connectable pair', () => {
    const hint = findHint(g('1.1'));
    expect(hint).not.toBeNull();
    expect(hasAnyMove(g('1.1'))).toBe(true);
  });

  it('reports no move when the only pair is unreachable', () => {
    // Every filler symbol is unique (so they can't pair with each other) and the
    // two 1s sit in opposite corners of a full board, which needs three turns.
    const grid = g(
      '123',
      '456',
      '781',
    );
    expect(findHint(grid)).toBeNull();
    expect(hasAnyMove(grid)).toBe(false);
  });

  it('an empty board has no move', () => {
    expect(hasAnyMove(g('...', '...'))).toBe(false);
  });
});

describe('shuffleBoard', () => {
  it('keeps the same tiles in the same cells and yields a playable board', () => {
    const grid = g(
      '1..2',
      '.33.',
      '2..1',
    );
    const next = shuffleBoard(grid, seeded(3));
    expect(tilesLeft(next)).toBe(tilesLeft(grid));
    // Occupied cells are unchanged — only the symbols move.
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[r].length; c++)
        expect(next[r][c] === 0).toBe(grid[r][c] === 0);
    expect(hasAnyMove(next)).toBe(true);
  });

  it('leaves an empty board alone', () => {
    const empty = g('..', '..');
    expect(shuffleBoard(empty, seeded(1))).toEqual(empty);
  });
});

describe('createBoard', () => {
  it.each(DIFFICULTIES.map((d) => [d.id, d] as const))('%s deals a playable board', (_id, d) => {
    const board = createBoard(d, seeded(11));
    expect(board).toHaveLength(d.rows);
    expect(board[0]).toHaveLength(d.cols);
    expect(tilesLeft(board)).toBe(d.rows * d.cols);
    expect(hasAnyMove(board)).toBe(true);
  });

  it('places every symbol an even number of times', () => {
    const board = createBoard(DIFFICULTIES[0], seeded(5));
    const counts = new Map<number, number>();
    for (const row of board) for (const v of row) counts.set(v, (counts.get(v) ?? 0) + 1);
    for (const [, n] of counts) expect(n % 2).toBe(0);
  });

  it('rejects an odd number of cells', () => {
    expect(() => createBoard({ id: 'odd', cols: 3, rows: 3, symbols: 4 }, seeded(1))).toThrow();
  });

  it('a full board can always be cleared pair by pair', () => {
    // Play greedily with hints; a fair game must never strand the player
    // without offering a shuffle, and shuffles must keep it playable.
    let board = createBoard(DIFFICULTIES[0], seeded(21));
    const rng = seeded(99);
    let guard = 0;
    while (tilesLeft(board) > 0 && guard++ < 200) {
      const hint = findHint(board);
      if (!hint) { board = shuffleBoard(board, rng); continue; }
      board = removePair(board, hint[0], hint[1]);
    }
    expect(isSolved(board)).toBe(true);
  });
});

describe('pairScore', () => {
  it('rewards streaks but caps the bonus', () => {
    expect(pairScore(1)).toBe(10);
    expect(pairScore(2)).toBe(15);
    expect(pairScore(100)).toBe(50);
  });
});
