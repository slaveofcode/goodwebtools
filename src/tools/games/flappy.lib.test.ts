import { describe, it, expect } from 'vitest';
import { stepBird, outOfBounds, hitsPipe } from './flappy.lib';

describe('stepBird', () => {
  it('applies gravity to velocity then position', () => {
    const r = stepBird(0, 0, 0.1, 1000);
    expect(r.v).toBeCloseTo(100, 6); // 0 + 1000*0.1
    expect(r.y).toBeCloseTo(10, 6); // 0 + 100*0.1
  });
  it('a flap (negative velocity) moves the bird up', () => {
    const r = stepBird(200, -500, 0.1, 1000);
    expect(r.v).toBeCloseTo(-400, 6);
    expect(r.y).toBeLessThan(200);
  });
});

describe('outOfBounds', () => {
  it('detects hitting the ceiling and floor', () => {
    expect(outOfBounds(5, 10, 600)).toBe(true); // top
    expect(outOfBounds(595, 10, 600)).toBe(true); // bottom
    expect(outOfBounds(300, 10, 600)).toBe(false);
  });
});

describe('hitsPipe', () => {
  // pipe at x=100 width=60, gap between y=200 and y=380
  const call = (bx: number, by: number) => hitsPipe(bx, by, 12, 100, 60, 200, 380);
  it('passes through the gap', () => {
    expect(call(120, 290)).toBe(false);
  });
  it('hits the top pipe', () => {
    expect(call(120, 150)).toBe(true);
  });
  it('hits the bottom pipe', () => {
    expect(call(120, 420)).toBe(true);
  });
  it('misses when not overlapping the pipe horizontally', () => {
    expect(call(300, 150)).toBe(false);
  });
});
