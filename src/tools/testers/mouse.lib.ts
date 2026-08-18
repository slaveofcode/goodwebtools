/**
 * Mouse-test maths: button names, double-click detection and pointer drift.
 * Pure and framework-free; the island attaches the pointer/mouse listeners.
 */

export interface Point { x: number; y: number }

/** Human name for a MouseEvent.button index. */
export function buttonName(button: number): string {
  switch (button) {
    case 0: return 'Left';
    case 1: return 'Middle';
    case 2: return 'Right';
    case 3: return 'Back';
    case 4: return 'Forward';
    default: return `Button ${button}`;
  }
}

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Whether two clicks form a double-click: close enough in time and space.
 * A dying mouse "drifts" — the second click lands too far away or too late.
 */
export function isDoubleClick(
  t1: number,
  t2: number,
  a: Point,
  b: Point,
  maxGapMs = 500,
  maxDriftPx = 8,
): boolean {
  const gap = t2 - t1;
  return gap >= 0 && gap <= maxGapMs && distance(a, b) <= maxDriftPx;
}

/** Clamp scroll delta to a direction: -1 up, 1 down, 0 none. */
export function scrollDirection(deltaY: number): -1 | 0 | 1 {
  if (deltaY < 0) return -1;
  if (deltaY > 0) return 1;
  return 0;
}
