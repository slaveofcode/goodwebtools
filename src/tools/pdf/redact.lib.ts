/**
 * Pure geometry helper for the redaction UI: turn a pointer drag (two points in
 * element pixel space) into a page-relative box of top-left-origin ratios,
 * clamped to the page. The PDF-space coordinate flip happens in the mupdf worker.
 */

export interface RatioRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function normalizeDragRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number,
): RatioRect {
  if (width <= 0 || height <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const right = Math.max(x1, x2);
  const bottom = Math.max(y1, y2);
  const x = clamp01(left / width);
  const y = clamp01(top / height);
  return {
    x,
    y,
    w: clamp01(right / width) - x,
    h: clamp01(bottom / height) - y,
  };
}
