/**
 * Pure logic for the endless side-scrolling runner (a richer take on the
 * offline-dino idea): jump/duck physics, obstacle spawning, collision and
 * difficulty ramp. Framework-free so it can be unit-tested; the island owns
 * the canvas and rAF loop.
 */

export const GROUND_Y = 220;
export const RUNNER_X = 60;
export const GRAVITY = 2400;
export const JUMP_V = -760;
/** Extra downward accel while holding down — snappy fast-fall. */
export const FAST_FALL = 2600;

export type ObstacleKind = 'cactus' | 'rock' | 'bird';

export interface Obstacle {
  x: number;
  kind: ObstacleKind;
  w: number;
  h: number;
  /** Distance above the ground (birds fly at two heights). */
  y: number;
  scored: boolean;
}

export interface Runner {
  y: number;      // feet position (0 = on the ground, negative = airborne)
  v: number;
  ducking: boolean;
  /** Jumps used since last touching the ground (double jump allowed). */
  jumps: number;
}

export const newRunner = (): Runner => ({ y: 0, v: 0, ducking: false, jumps: 0 });

/** Runner hitbox height (ducking halves it). */
export const runnerHeight = (r: Runner): number => (r.ducking && r.y === 0 ? 22 : 44);
export const RUNNER_W = 34;

/** Advance the runner one step. Returns a new runner (input unchanged). */
export function stepRunner(r: Runner, dt: number, holdDown: boolean): Runner {
  const airborne = r.y < 0 || r.v < 0;
  const g = GRAVITY + (holdDown && airborne ? FAST_FALL : 0);
  let v = r.v + g * dt;
  let y = r.y + v * dt;
  let jumps = r.jumps;
  if (y >= 0) { y = 0; v = 0; jumps = 0; }
  return { y, v, ducking: holdDown && y === 0, jumps };
}

/** Jump if allowed (ground jump or one mid-air double jump). */
export function jump(r: Runner): Runner {
  if (r.jumps >= 2) return r;
  // A double jump is slightly weaker so it stays a control, not a cheat.
  const power = r.jumps === 0 ? JUMP_V : JUMP_V * 0.82;
  return { ...r, v: power, jumps: r.jumps + 1, ducking: false };
}

/** Speed ramps with score and then plateaus so it stays playable. */
export function speedAt(score: number): number {
  return Math.min(560, 240 + score * 4);
}

/** Seconds between spawns at a given speed (with a randomness factor 0..1). */
export function spawnGap(speed: number, rand: number): number {
  const base = 900 / speed; // constant-ish distance between obstacles
  return base * (0.85 + rand * 0.7);
}

/** Build an obstacle for the given roll (rand 0..1). Birds appear later. */
export function makeObstacle(x: number, score: number, rand: number): Obstacle {
  if (score >= 12 && rand > 0.72) {
    // Low birds must be ducked (they clip a standing runner); high birds fly
    // overhead and only catch you if you jump into them.
    const high = rand > 0.86;
    return { x, kind: 'bird', w: 34, h: 24, y: high ? 76 : 30, scored: false };
  }
  if (rand > 0.45) return { x, kind: 'cactus', w: 22, h: 46, y: 0, scored: false };
  if (rand > 0.2) return { x, kind: 'cactus', w: 40, h: 46, y: 0, scored: false }; // wide double cactus
  return { x, kind: 'rock', w: 28, h: 26, y: 0, scored: false };
}

/** Axis-aligned overlap between the runner and an obstacle. */
export function hits(r: Runner, o: Obstacle): boolean {
  const rTop = GROUND_Y + r.y - runnerHeight(r);
  const rBottom = GROUND_Y + r.y;
  const rLeft = RUNNER_X;
  const rRight = RUNNER_X + RUNNER_W;
  const oBottom = GROUND_Y - o.y;
  const oTop = oBottom - o.h;
  const oLeft = o.x;
  const oRight = o.x + o.w;
  // Small forgiveness margin so near-misses feel fair.
  const m = 4;
  return rRight - m > oLeft && rLeft + m < oRight && rBottom - m > oTop && rTop + m < oBottom;
}
