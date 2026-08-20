import { describe, it, expect } from 'vitest';
import { GRID, initialState, step, queueTurn, opposite, freeCell, tickMs, cellEq, type SnakeState, type Cell } from './snake.lib';

const rng0 = () => 0; // deterministic: always the first free cell

const withFood = (s: SnakeState, food: Cell): SnakeState => ({ ...s, food: { ...food, kind: 'normal', life: 0 } });

describe('snake movement', () => {
  it('moves in the current direction, keeping its length', () => {
    const s = initialState(rng0);
    const n = step(s, { rng: rng0 });
    expect(n.snake[0]).toEqual({ x: 9, y: 10 });
    expect(n.snake).toHaveLength(s.snake.length);
  });

  it('grows and scores when eating', () => {
    const s = withFood(initialState(rng0), { x: 9, y: 10 });
    const n = step(s, { rng: rng0 });
    expect(n.score).toBe(1);
    expect(n.snake).toHaveLength(s.snake.length + 1);
  });

  it('dies on a wall by default', () => {
    const s: SnakeState = { ...initialState(rng0), snake: [{ x: GRID - 1, y: 5 }], dir: 'right' };
    expect(step(s, { rng: rng0 }).alive).toBe(false);
  });

  it('wraps around when wrap is enabled', () => {
    const s: SnakeState = { ...initialState(rng0), snake: [{ x: GRID - 1, y: 5 }], dir: 'right' };
    const n = step(s, { wrap: true, rng: rng0 });
    expect(n.alive).toBe(true);
    expect(n.snake[0]).toEqual({ x: 0, y: 5 });
  });

  it('dies when biting its own body', () => {
    // U-shaped snake; moving down from the head runs into its own segment.
    const snake: Cell[] = [
      { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 },
    ];
    const s: SnakeState = { ...initialState(rng0), snake, dir: 'down', food: { x: 0, y: 0, kind: 'normal', life: 0 } };
    expect(step(s, { rng: rng0 }).alive).toBe(false);
  });

  it('may move into the cell the tail is vacating', () => {
    const snake: Cell[] = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }];
    const s: SnakeState = { ...initialState(rng0), snake, dir: 'down', food: { x: 0, y: 0, kind: 'normal', life: 0 } };
    expect(step(s, { rng: rng0 }).alive).toBe(true); // (5,6) is the tail, it moves away
  });
});

describe('turn queue', () => {
  it('ignores reversals', () => {
    const s = initialState(rng0); // heading right
    expect(queueTurn(s, 'left').queue).toEqual([]);
  });

  it('ignores repeats of the pending direction', () => {
    const s = queueTurn(initialState(rng0), 'up');
    expect(queueTurn(s, 'up').queue).toEqual(['up']);
  });

  it('queues two quick turns and applies them on consecutive ticks', () => {
    let s = initialState(rng0);
    s = queueTurn(s, 'up');
    s = queueTurn(s, 'left'); // legal relative to 'up'
    expect(s.queue).toEqual(['up', 'left']);
    s = step(s, { rng: rng0 });
    expect(s.dir).toBe('up');
    s = step(s, { rng: rng0 });
    expect(s.dir).toBe('left');
    expect(s.queue).toEqual([]);
  });

  it('caps the queue at two', () => {
    let s = initialState(rng0);
    s = queueTurn(s, 'up');
    s = queueTurn(s, 'left');
    s = queueTurn(s, 'down');
    expect(s.queue).toHaveLength(2);
  });

  it('opposite() detects reversals', () => {
    expect(opposite('up', 'down')).toBe(true);
    expect(opposite('left', 'right')).toBe(true);
    expect(opposite('up', 'left')).toBe(false);
  });
});

describe('food', () => {
  it('every fifth food is a bonus worth 5', () => {
    let s = withFood(initialState(rng0), { x: 9, y: 10 });
    s = { ...s, score: 4 }; // next eat makes 5 → bonus spawns
    const n = step(s, { rng: rng0 });
    expect(n.score).toBe(5);
    expect(n.food.kind).toBe('bonus');
    expect(n.food.life).toBeGreaterThan(0);
  });

  it('eating a bonus scores 5', () => {
    const s: SnakeState = { ...initialState(rng0), food: { x: 9, y: 10, kind: 'bonus', life: 10 } };
    expect(step(s, { rng: rng0 }).score).toBe(5);
  });

  it('bonus food decays and downgrades to normal when it expires', () => {
    let s: SnakeState = { ...initialState(rng0), food: { x: 0, y: 0, kind: 'bonus', life: 2 } };
    s = step(s, { rng: rng0 });
    expect(s.food.life).toBe(1);
    s = step(s, { rng: rng0 });
    expect(s.food.kind).toBe('normal');
  });

  it('freeCell never returns an occupied cell', () => {
    const occupied: Cell[] = [];
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (!(x === 3 && y === 3)) occupied.push({ x, y });
    expect(freeCell(occupied, rng0)).toEqual({ x: 3, y: 3 });
  });

  it('freeCell returns null on a full board', () => {
    const occupied: Cell[] = [];
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) occupied.push({ x, y });
    expect(freeCell(occupied, rng0)).toBeNull();
  });

  it('cellEq compares coordinates', () => {
    expect(cellEq({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(cellEq({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });
});

describe('speed', () => {
  it('gets faster with score but never below the floor', () => {
    expect(tickMs(0)).toBe(150);
    expect(tickMs(10)).toBeLessThan(tickMs(0));
    expect(tickMs(1000)).toBe(70);
  });
});
