import { describe, it, expect } from 'vitest';
import {
  newRunner, stepRunner, jump, speedAt, spawnGap, makeObstacle, hits, runnerHeight,
  GROUND_Y, RUNNER_X, type Obstacle,
} from './runner.lib';

describe('runner physics', () => {
  it('stays grounded when idle', () => {
    const r = stepRunner(newRunner(), 0.016, false);
    expect(r.y).toBe(0);
    expect(r.v).toBe(0);
  });

  it('jump launches upward then gravity brings it back down', () => {
    let r = jump(newRunner());
    expect(r.v).toBeLessThan(0);
    for (let i = 0; i < 5; i++) r = stepRunner(r, 0.016, false);
    expect(r.y).toBeLessThan(0); // airborne
    for (let i = 0; i < 200; i++) r = stepRunner(r, 0.016, false);
    expect(r.y).toBe(0);         // landed
    expect(r.jumps).toBe(0);     // reset on landing
  });

  it('allows a double jump but not a third', () => {
    const first = jump(newRunner());
    const airborne = stepRunner(first, 0.016, false);
    const second = jump(airborne);
    expect(second.jumps).toBe(2);
    const third = jump(second);
    expect(third.v).toBe(second.v); // unchanged — refused
    expect(third.jumps).toBe(2);
  });

  it('fast-fall accelerates descent while airborne', () => {
    let a = jump(newRunner());
    let b = { ...a };
    for (let i = 0; i < 10; i++) { a = stepRunner(a, 0.016, false); b = stepRunner(b, 0.016, true); }
    expect(b.y).toBeGreaterThan(a.y); // b is lower (closer to ground)
  });

  it('ducking only applies on the ground and halves the hitbox', () => {
    const ducked = stepRunner(newRunner(), 0.016, true);
    expect(ducked.ducking).toBe(true);
    expect(runnerHeight(ducked)).toBeLessThan(runnerHeight(newRunner()));
    const airborne = stepRunner(jump(newRunner()), 0.016, true);
    expect(airborne.ducking).toBe(false);
  });
});

describe('difficulty', () => {
  it('speed increases with score then plateaus', () => {
    expect(speedAt(0)).toBe(240);
    expect(speedAt(10)).toBeGreaterThan(speedAt(0));
    expect(speedAt(1000)).toBe(560);
  });

  it('spawn gap shrinks as speed rises', () => {
    expect(spawnGap(500, 0.5)).toBeLessThan(spawnGap(250, 0.5));
  });

  it('spawn gap varies with randomness but stays positive', () => {
    expect(spawnGap(300, 0)).toBeGreaterThan(0);
    expect(spawnGap(300, 1)).toBeGreaterThan(spawnGap(300, 0));
  });
});

describe('obstacles', () => {
  it('never spawns birds early', () => {
    for (const rand of [0, 0.5, 0.75, 0.9, 1]) {
      expect(makeObstacle(100, 0, rand).kind).not.toBe('bird');
    }
  });

  it('spawns birds at two heights once the score is high enough', () => {
    const low = makeObstacle(100, 20, 0.8);
    const high = makeObstacle(100, 20, 0.95);
    expect(low.kind).toBe('bird');
    expect(high.kind).toBe('bird');
    expect(high.y).toBeGreaterThan(low.y);
  });

  it('ground obstacles sit on the ground', () => {
    expect(makeObstacle(100, 0, 0.1).y).toBe(0);
    expect(makeObstacle(100, 0, 0.6).y).toBe(0);
  });
});

describe('collision', () => {
  const ground = (x: number): Obstacle => ({ x, kind: 'cactus', w: 22, h: 46, y: 0, scored: false });
  const highBird = (x: number): Obstacle => ({ x, kind: 'bird', w: 34, h: 24, y: 76, scored: false });
  const lowBird = (x: number): Obstacle => ({ x, kind: 'bird', w: 34, h: 24, y: 30, scored: false });

  it('hits a cactus while running on the ground', () => {
    expect(hits(newRunner(), ground(RUNNER_X + 10))).toBe(true);
  });

  it('misses obstacles that are far away', () => {
    expect(hits(newRunner(), ground(RUNNER_X + 400))).toBe(false);
    expect(hits(newRunner(), ground(RUNNER_X - 400))).toBe(false);
  });

  it('clears a cactus when jumping high enough', () => {
    const air = { ...newRunner(), y: -80 };
    expect(hits(air, ground(RUNNER_X + 10))).toBe(false);
  });

  it('a high bird passes over a ducking runner', () => {
    const ducked = { ...newRunner(), ducking: true };
    expect(hits(ducked, highBird(RUNNER_X + 5))).toBe(false);
  });

  it('a low bird still hits a standing runner', () => {
    expect(hits(newRunner(), lowBird(RUNNER_X + 5))).toBe(true);
  });

  it('ducking dodges a low bird (that is the point of ducking)', () => {
    const ducked = { ...newRunner(), ducking: true };
    expect(hits(ducked, lowBird(RUNNER_X + 5))).toBe(false);
  });

  it('jumping into a high bird is punished', () => {
    const air = { ...newRunner(), y: -60 };
    expect(hits(air, highBird(RUNNER_X + 5))).toBe(true);
  });

  it('ground obstacle geometry is anchored to the ground line', () => {
    const o = ground(RUNNER_X);
    expect(GROUND_Y - o.y - o.h).toBeLessThan(GROUND_Y);
  });
});
