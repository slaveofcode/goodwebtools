/**
 * Pure physics and collision for the flying-bird (flappy) game. The render loop
 * and input live in the island; the maths is here and unit-tested.
 */

export interface Pipe {
  x: number;
  gapTop: number;
  gapBottom: number;
  scored: boolean;
}

/** Advance the bird by dt seconds under gravity (px, px/s, s, px/s²). */
export function stepBird(y: number, v: number, dt: number, gravity: number): { y: number; v: number } {
  const nv = v + gravity * dt;
  return { y: y + nv * dt, v: nv };
}

/** True when the bird (centre y, radius) hits the ceiling or floor of a world of height h. */
export function outOfBounds(y: number, radius: number, worldHeight: number): boolean {
  return y - radius <= 0 || y + radius >= worldHeight;
}

/**
 * True when the bird circle (birdX, birdY, radius) collides with a pipe at
 * `pipeX` of width `pipeWidth` whose gap runs from `gapTop` to `gapBottom`.
 */
export function hitsPipe(
  birdX: number, birdY: number, radius: number,
  pipeX: number, pipeWidth: number, gapTop: number, gapBottom: number,
): boolean {
  const overlapX = birdX + radius > pipeX && birdX - radius < pipeX + pipeWidth;
  if (!overlapX) return false;
  const insideGap = birdY - radius > gapTop && birdY + radius < gapBottom;
  return !insideGap;
}
