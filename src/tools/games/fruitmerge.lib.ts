/**
 * Pure helpers for Fruit Merge: a compact circle physics world (gravity, wall
 * constraints, iterative pair correction with low restitution), same-tier
 * merging, and game-over detection. Rendering, the RAF loop, and input live
 * in the island. The world is treated immutably — every step returns a new
 * World — and iteration order is deterministic (ascending id) so tests are
 * reproducible.
 */

export interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tier: number;
}

export interface World {
  fruits: Fruit[];
  nextId: number;
  score: number;
  over: boolean;
  /** Consecutive calm steps each fruit has spent above the deadline (internal). */
  calmMap: ReadonlyMap<number, number>;
}

/** Logical play box; the island scales the canvas to this. */
export const BOX = { w: 360, h: 480, wall: 10 } as const;

/** Radii per tier (px in logical units) — cherry → watermelon. */
export const TIER_RADII = [16, 22, 29, 37, 46, 56, 66, 77, 88, 99, 110] as const;

/** Points awarded for merging tier i + i → i+1 (triangular numbers). */
export const MERGE_SCORES = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66] as const;

/** Y position where dropped fruits spawn. */
export const DROP_Y = 40;
/** The loss line — a settled fruit whose center is above this loses the game. */
export const DEADLINE_Y = 90;
/** Only tiers 0..MAX_DROP_TIER are ever handed to the player. */
export const MAX_DROP_TIER = 4;

const GRAVITY = 900;
/** Near-inelastic contacts: Suika fruits barely bounce, and stacking stays calm. */
const RESTITUTION = 0.02;
/** Bounces slower than this snap to rest instead of jittering forever. */
const REST_CUTOFF = 20;
const DAMPING = 0.995;
const SOLVER_ITERATIONS = 8;
const MERGE_SLOP = 0.5;
/** Positional correction softness — hard correction launches fruits in jams. */
const CORRECTION_FACTOR = 0.3;
const CORRECTION_SLOP = 0.5;
/** Max single correction per pair, per iteration (px). */
const CORRECTION_MAX = 1.5;
/** Hard speed cap (px/s) — a safety net against solver energy spikes. */
const MAX_SPEED = 1200;
/** Calm threshold — a fruit that moves slower than this (px/s, measured as
 *  per-step displacement) counts as settled for the game-over check. */
const CALM_SPEED = 12;
/** Consecutive calm steps above the line before game over. */
const CALM_FRAMES = 45;

/** A fresh, empty world. */
export function newWorld(): World {
  return { fruits: [], nextId: 1, score: 0, over: false, calmMap: new Map() };
}

/** Map a [0,1) rng value to a droppable tier (0–4). */
export function pickDropTier(rng: () => number): number {
  const clamped = Math.min(Math.max(rng(), 0), 0.9999999);
  return Math.floor(clamped * (MAX_DROP_TIER + 1));
}

/** Spawn a fruit of `tier` at (clamped) x on the drop line. */
export function dropFruit(w: World, x: number, tier: number): World {
  if (tier > MAX_DROP_TIER) throw new Error(`tier ${tier} exceeds max drop tier ${MAX_DROP_TIER}`);
  const r = TIER_RADII[tier];
  const clampedX = Math.min(Math.max(x, BOX.wall + r), BOX.w - BOX.wall - r);
  return {
    ...w,
    fruits: [...w.fruits, { id: w.nextId, x: clampedX, y: DROP_Y, vx: 0, vy: 0, tier }],
    nextId: w.nextId + 1,
  };
}

/** Advance the world by dt seconds (fixed step; use small dt like 1/60). */
export function stepWorld(w: World, dt: number): World {
  if (w.over) return w;

  // 1) Integrate (semi-implicit Euler + light damping).
  const sim = w.fruits.map(f => ({ ...f }));
  for (const f of sim) {
    f.vy += GRAVITY * dt;
    f.vx *= DAMPING;
    f.vy *= DAMPING;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }

  // 2) Solve constraints iteratively: walls, then every pair.
  for (let it = 0; it < SOLVER_ITERATIONS; it++) {
    for (const f of sim) {
      const r = TIER_RADII[f.tier];
      const left = BOX.wall + r;
      const right = BOX.w - BOX.wall - r;
      const floor = BOX.h - r;
      const reflect = (v: number) => {
        const bounced = -v * RESTITUTION;
        return Math.abs(bounced) < REST_CUTOFF ? 0 : bounced;
      };
      if (f.x < left) { f.x = left; if (f.vx < 0) f.vx = reflect(f.vx); }
      if (f.x > right) { f.x = right; if (f.vx > 0) f.vx = reflect(f.vx); }
      if (f.y > floor) { f.y = floor; if (f.vy > 0) f.vy = reflect(f.vy); }
      // no ceiling — fruits may bounce above the box and fall back
    }
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i]!;
        const b = sim[j]!;
        const ra = TIER_RADII[a.tier];
        const rb = TIER_RADII[b.tier];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const minDist = ra + rb;
        if (distSq >= minDist * minDist) continue;
        let dist = Math.sqrt(distSq);
        let nx: number;
        let ny: number;
        if (dist === 0) {
          // Coincident centers (a fruit dropped dead-center on another):
          // separate along a deterministic axis so the pair can't fuse into
          // an unresolvable blob that later fruits launch upward.
          nx = 0;
          ny = a.id < b.id ? -1 : 1;
          dist = 0;
        } else {
          nx = dx / dist;
          ny = dy / dist;
        }
        const overlap = minDist - dist;        // Soft positional correction (slop + capped), split by inverse radius
        // (bigger = heavier). Soft is essential: hard correction in a jammed
        // pile launches fruits out of the box.
        const correction = Math.min(
          Math.max(overlap - CORRECTION_SLOP, 0) * CORRECTION_FACTOR,
          CORRECTION_MAX,
        );
        const wa = rb / (ra + rb);
        const wb = ra / (ra + rb);
        a.x -= nx * correction * wa;
        a.y -= ny * correction * wa;
        b.x += nx * correction * wb;
        b.y += ny * correction * wb;
        // Zero-restitution impulse: stops approach without adding bounce.
        // (With e > 0 the correction/impulse loop pumps energy in jams and
        // launches fruits out of the box; with e = 0 momentum is conserved
        // and stacks stay put.)
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const ma = ra * ra;
          const mb = rb * rb;
          const jimp = -vn / (1 / ma + 1 / mb);
          a.vx -= (jimp / ma) * nx;
          a.vy -= (jimp / ma) * ny;
          b.vx += (jimp / mb) * nx;
          b.vy += (jimp / mb) * ny;
        }
      }
    }
  }

  // 3) Speed cap — safety net against solver energy spikes in dense piles.
  for (const f of sim) {
    const speed = Math.hypot(f.vx, f.vy);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      f.vx *= scale;
      f.vy *= scale;
    }
  }

  // 4) Merge pass: same-tier pairs in contact (ascending id, one pass/step).
  const ordered = [...sim].sort((a, b) => a.id - b.id);
  const merged = new Set<number>();
  const pairs: [typeof ordered[0], typeof ordered[0]][] = [];
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i]!;
      const b = ordered[j]!;
      if (a.tier !== b.tier) continue;
      if (a.tier >= TIER_RADII.length - 1) continue; // watermelons don't merge
      if (merged.has(a.id) || merged.has(b.id)) continue;
      const minDist = TIER_RADII[a.tier] + TIER_RADII[b.tier] + MERGE_SLOP;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy <= minDist * minDist) {
        pairs.push([a, b]);
        merged.add(a.id);
        merged.add(b.id);
      }
    }
  }
  const survivors: Fruit[] = ordered
    .filter(f => !merged.has(f.id))
    .map(f => ({ id: f.id, x: f.x, y: f.y, vx: f.vx, vy: f.vy, tier: f.tier }));
  let score = w.score;
  let nextId = w.nextId;
  for (const [a, b] of pairs) {
    const newTier = a.tier + 1;
    const nr = TIER_RADII[newTier]!;
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    // Keep the merged fruit inside the walls and above the floor.
    const cx = Math.min(Math.max(x, BOX.wall + nr), BOX.w - BOX.wall - nr);
    const cy = Math.min(y, BOX.h - nr);
    survivors.push({ id: nextId++, x: cx, y: cy, vx: (a.vx + b.vx) / 2, vy: (a.vy + b.vy) / 2, tier: newTier });
    score += MERGE_SCORES[a.tier]!;
  }

  // 5) Game over: a fruit above the deadline that has not *moved* for
  // sustained frames. Displacement (not velocity) is the test — in a jammed
  // pile gravity and contact impulses cancel, leaving fruits with a phantom
  // velocity while sitting perfectly still.
  const prevById = new Map(w.fruits.map(f => [f.id, f]));
  const calmMap = new Map<number, number>();
  let over = false;
  for (const f of survivors) {
    if (f.y >= DEADLINE_Y) continue;
    const prev = prevById.get(f.id);
    const moved = prev ? Math.hypot(f.x - prev.x, f.y - prev.y) : Infinity;
    if (moved >= dt * CALM_SPEED) continue;
    const nextCalm = (w.calmMap.get(f.id) ?? 0) + 1;
    calmMap.set(f.id, nextCalm);
    if (nextCalm >= CALM_FRAMES) over = true;
  }

  return { fruits: survivors, nextId, score, over, calmMap };
}
