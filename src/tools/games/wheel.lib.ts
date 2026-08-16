/**
 * Pure helpers for the wheel / random picker: parse entries, pick an index from
 * a random value, and map a rotation angle to the slice under the pointer. The
 * canvas drawing and spin animation live in the island.
 */

export function parseEntries(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** Map a random value in [0,1] to an index in [0, count). Returns -1 if empty. */
export function chooseIndex(count: number, r: number): number {
  if (count <= 0) return -1;
  const clamped = Math.min(Math.max(r, 0), 0.9999999);
  return Math.floor(clamped * count);
}

/**
 * Given the wheel's rotation angle (degrees) and the slice count, return the
 * index of the slice currently under the top pointer. Slice 0 starts at the top.
 */
export function sliceForAngle(angleDeg: number, count: number): number {
  if (count <= 0) return -1;
  const per = 360 / count;
  // The wheel rotates by angleDeg; the slice under the fixed top pointer is the
  // one whose original position rotated to the top.
  const normalized = ((angleDeg % 360) + 360) % 360;
  return Math.floor(normalized / per) % count;
}
