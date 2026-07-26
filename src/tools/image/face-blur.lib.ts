export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Grow a detection box by `factor` (0.3 = +30%) around its center and clamp it
 * to the image bounds. Face-detector boxes are tight around the face; a little
 * padding covers the forehead/chin/ears so the blur fully hides the person.
 */
export function expandBox(box: Box, factor: number, maxW: number, maxH: number): Box {
  const dx = (box.w * factor) / 2;
  const dy = (box.h * factor) / 2;
  const x = Math.max(0, box.x - dx);
  const y = Math.max(0, box.y - dy);
  const right = Math.min(maxW, box.x + box.w + dx);
  const bottom = Math.min(maxH, box.y + box.h + dy);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}
