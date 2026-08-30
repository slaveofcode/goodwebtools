import { describe, it, expect } from 'vitest';
import {
  stepWorld,
  dropFruit,
  newWorld,
  TIER_RADII,
  MERGE_SCORES,
  BOX,
  DROP_Y,
  DEADLINE_Y,
  pickDropTier,
  type World,
} from './fruitmerge.lib';

const DT = 1 / 60;

function run(w: World, steps: number): World {
  let world = w;
  for (let i = 0; i < steps; i++) world = stepWorld(world, DT);
  return world;
}

describe('constants', () => {
  it('has 11 tiers with strictly growing radii and scores', () => {
    expect(TIER_RADII).toHaveLength(11);
    expect(MERGE_SCORES).toHaveLength(11);
    for (let i = 1; i < 11; i++) {
      expect(TIER_RADII[i]).toBeGreaterThan(TIER_RADII[i - 1]);
      expect(MERGE_SCORES[i]).toBeGreaterThan(MERGE_SCORES[i - 1]);
    }
  });
});

describe('stepWorld', () => {
  it('applies gravity — a lone fruit falls', () => {
    const w: World = {
      ...newWorld(),
      fruits: [{ id: 1, x: BOX.w / 2, y: 100, vx: 0, vy: 0, tier: 0 }],
    };
    const next = stepWorld(w, DT);
    expect(next.fruits[0]!.y).toBeGreaterThan(100);
    expect(next.fruits[0]!.vy).toBeGreaterThan(0);
  });

  it('lands on the floor and settles', () => {
    const w = run(settledWorldFromHeight(50), 400);
    const f = w.fruits[0]!;
    const r = TIER_RADII[0];
    expect(f.y).toBeGreaterThanOrEqual(BOX.h - r - 0.01);
    expect(f.y).toBeLessThanOrEqual(BOX.h - r + 2);
    expect(Math.abs(f.vy)).toBeLessThan(0.5);
    expect(w.over).toBe(false);
  });

  it('clamps fruits inside the side walls', () => {
    const w: World = {
      ...newWorld(),
      fruits: [{ id: 1, x: 2, y: 300, vx: -50, vy: 0, tier: 0 }],
    };
    const out = run(w, 120);
    const f = out.fruits[0]!;
    expect(f.x - TIER_RADII[0]).toBeGreaterThanOrEqual(BOX.wall - 0.01);
  });

  it('merges two same-tier fruits in contact', () => {
    const r = TIER_RADII[0];
    const w: World = {
      ...newWorld(),
      fruits: [
        { id: 1, x: BOX.w / 2 - r * 0.6, y: BOX.h - r, vx: 0, vy: 0, tier: 0 },
        { id: 2, x: BOX.w / 2 + r * 0.6, y: BOX.h - r, vx: 0, vy: 0, tier: 0 },
      ],
    };
    const out = run(w, 1);
    expect(out.fruits).toHaveLength(1);
    expect(out.fruits[0]!.tier).toBe(1);
    expect(out.score).toBe(MERGE_SCORES[0]);
    // merged fruit sits near the pair midpoint
    expect(out.fruits[0]!.x).toBeGreaterThan(BOX.w / 2 - 5);
    expect(out.fruits[0]!.x).toBeLessThan(BOX.w / 2 + 5);
  });

  it('does not merge different tiers in contact', () => {
    const r0 = TIER_RADII[0];
    const r1 = TIER_RADII[1];
    const w: World = {
      ...newWorld(),
      fruits: [
        { id: 1, x: BOX.w / 2 - 10, y: BOX.h - r0, vx: 0, vy: 0, tier: 0 },
        { id: 2, x: BOX.w / 2 + r0 + r1 - 12, y: BOX.h - r1, vx: 0, vy: 0, tier: 1 },
      ],
    };
    const out = run(w, 5);
    expect(out.fruits).toHaveLength(2);
    expect(out.score).toBe(0);
  });

  it('merge chains settle over successive steps (three of a kind)', () => {
    // Three tier-0 fruits stacked at the bottom: first two merge to tier 1,
    // the new tier-1 fruit then rests — no tier-1 pair left, so no cascade.
    const r = TIER_RADII[0];
    const w: World = {
      ...newWorld(),
      fruits: [
        { id: 1, x: BOX.w / 2 - r, y: BOX.h - r, vx: 0, vy: 0, tier: 0 },
        { id: 2, x: BOX.w / 2 + r, y: BOX.h - r, vx: 0, vy: 0, tier: 0 },
        { id: 3, x: BOX.w / 2, y: BOX.h - r * 2.2, vx: 0, vy: 0, tier: 0 },
      ],
    };
    const out = run(w, 30);
    expect(out.score).toBe(MERGE_SCORES[0]);
    expect(out.fruits.map(f => f.tier).sort()).toEqual([0, 1]);
  });

  it('declares game over when a fruit rests above the deadline', () => {
    // A stable tower: two watermelons stacked on the floor + a cherry resting
    // on top — its center (y=24) sits above the deadline (y=90), calm.
    const w: World = {
      ...newWorld(),
      fruits: [
        { id: 1, x: BOX.w / 2, y: BOX.h - TIER_RADII[10], vx: 0, vy: 0, tier: 10 },
        { id: 2, x: BOX.w / 2, y: 150, vx: 0, vy: 0, tier: 10 },
        { id: 3, x: BOX.w / 2, y: 24, vx: 0, vy: 0, tier: 0 },
      ],
    };
    const out = run(w, 600);
    expect(out.over).toBe(true);
    expect(out.fruits.find(f => f.id === 3)!.y).toBeLessThan(DEADLINE_Y);
  });

  it('does not declare game over for a fruit merely crossing the line while moving', () => {
    const w: World = {
      ...newWorld(),
      fruits: [{ id: 1, x: BOX.w / 2, y: 30, vx: 0, vy: 0, tier: 0 }],
    };
    // fast fall through the deadline zone — needs many calm frames to lose
    const out = run(w, 3);
    expect(out.over).toBe(false);
  });
});

describe('dropFruit', () => {
  it('spawns at the drop line clamped to the walls', () => {
    const w = dropFruit(newWorld(), -100, 0);
    expect(w.fruits[0]!.x).toBe(BOX.wall + TIER_RADII[0]);
    const w2 = dropFruit(newWorld(), BOX.w + 100, 0);
    expect(w2.fruits[0]!.x).toBe(BOX.w - BOX.wall - TIER_RADII[0]);
    const w3 = dropFruit(newWorld(), BOX.w / 2, 2);
    expect(w3.fruits[0]!.y).toBe(DROP_Y);
    expect(w3.fruits[0]!.tier).toBe(2);
  });

  it('refuses tiers beyond the max drop tier', () => {
    expect(() => dropFruit(newWorld(), BOX.w / 2, 5)).toThrow();
  });
});

describe('pickDropTier', () => {
  it('maps rng to tiers 0–4 deterministically', () => {
    expect(pickDropTier(() => 0)).toBe(0);
    expect(pickDropTier(() => 0.99)).toBe(4);
    expect(pickDropTier(() => 0.5)).toBe(2);
  });
});

function settledWorldFromHeight(height: number): World {
  const r = TIER_RADII[0];
  return {
    ...newWorld(),
    fruits: [{ id: 1, x: BOX.w / 2, y: BOX.h - r - height, vx: 0, vy: 0, tier: 0 }],
  };
}
