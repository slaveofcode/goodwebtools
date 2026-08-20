/**
 * Pure logic for the Snake game — a richer take on the classic: queued turns
 * (so fast double-taps aren't eaten), optional wall wrap, and golden bonus
 * food that expires. Framework-free; the island owns the canvas and timing.
 */

export const GRID = 20;

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Cell { x: number; y: number }
export type FoodKind = 'normal' | 'bonus';
export interface Food extends Cell { kind: FoodKind; /** Ticks left before a bonus expires. */ life: number }

export interface SnakeState {
  snake: Cell[];        // head first
  dir: Dir;
  /** Turns queued this tick (prevents dropped inputs on fast taps). */
  queue: Dir[];
  food: Food;
  score: number;
  alive: boolean;
  /** Ticks survived — drives the bonus-food schedule. */
  ticks: number;
}

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export const opposite = (a: Dir, b: Dir): boolean =>
  (a === 'up' && b === 'down') || (a === 'down' && b === 'up') ||
  (a === 'left' && b === 'right') || (a === 'right' && b === 'left');

/** Queue a turn, ignoring reversals and duplicates of the pending direction. */
export function queueTurn(s: SnakeState, dir: Dir): SnakeState {
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  if (dir === last || opposite(last, dir)) return s;
  if (s.queue.length >= 2) return s; // cap so inputs can't run far ahead
  return { ...s, queue: [...s.queue, dir] };
}

export const cellEq = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

/** Random free cell (rng: () => [0,1)); null when the board is full. */
export function freeCell(occupied: Cell[], rng: () => number): Cell | null {
  const taken = new Set(occupied.map((c) => `${c.x},${c.y}`));
  const free: Cell[] = [];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
  if (!free.length) return null;
  return free[Math.floor(rng() * free.length)];
}

export function initialState(rng: () => number = Math.random): SnakeState {
  const snake: Cell[] = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
  const spot = freeCell(snake, rng) ?? { x: 15, y: 10 };
  return { snake, dir: 'right', queue: [], food: { ...spot, kind: 'normal', life: 0 }, score: 0, alive: true, ticks: 0 };
}

/** Every Nth food spawns as an expiring bonus worth more points. */
const BONUS_EVERY = 5;
const BONUS_LIFE = 40;

export interface StepOptions { wrap?: boolean; rng?: () => number }

/** Advance one tick. Returns a new state (input unchanged). */
export function step(s: SnakeState, opts: StepOptions = {}): SnakeState {
  if (!s.alive) return s;
  const { wrap = false, rng = Math.random } = opts;

  const queue = [...s.queue];
  const dir = queue.length ? queue.shift()! : s.dir;
  const d = DELTA[dir];
  let head: Cell = { x: s.snake[0].x + d.x, y: s.snake[0].y + d.y };

  if (wrap) {
    head = { x: (head.x + GRID) % GRID, y: (head.y + GRID) % GRID };
  } else if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
    return { ...s, dir, queue, alive: false };
  }

  const ate = cellEq(head, s.food);
  // The tail cell is vacated this tick, so moving into it is legal (unless eating).
  const body = ate ? s.snake : s.snake.slice(0, -1);
  if (body.some((c) => cellEq(c, head))) return { ...s, dir, queue, alive: false };

  const snake = [head, ...body];
  const ticks = s.ticks + 1;

  let food = s.food;
  let score = s.score;
  if (ate) {
    score += s.food.kind === 'bonus' ? 5 : 1;
    const eaten = score;
    const spot = freeCell(snake, rng);
    if (!spot) return { ...s, snake, dir, queue, score, alive: false }; // board filled — a win
    const kind: FoodKind = eaten % BONUS_EVERY === 0 ? 'bonus' : 'normal';
    food = { ...spot, kind, life: kind === 'bonus' ? BONUS_LIFE : 0 };
  } else if (food.kind === 'bonus') {
    // Bonus food decays; when it expires it becomes ordinary food.
    const life = food.life - 1;
    food = life <= 0 ? { ...food, kind: 'normal', life: 0 } : { ...food, life };
  }

  return { snake, dir, queue, food, score, alive: true, ticks };
}

/** Tick interval (ms): speeds up with score, floored so it stays playable. */
export function tickMs(score: number): number {
  return Math.max(70, 150 - score * 2);
}
