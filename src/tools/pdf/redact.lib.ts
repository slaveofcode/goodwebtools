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

/**
 * Convert a page-relative box (top-left-origin ratios) to a mupdf page rectangle
 * `[x0, y0, x1, y1]`. MuPDF's page/annotation space is top-left origin with y
 * increasing downward — the same orientation as the rendered preview image — so
 * the mapping is a direct scale with NO vertical flip.
 */
export function boxToRect(
  box: { x: number; y: number; w: number; h: number },
  bounds: [number, number, number, number],
): [number, number, number, number] {
  const [x0, y0, x1, y1] = bounds;
  const pw = x1 - x0;
  const ph = y1 - y0;
  return [
    x0 + box.x * pw,
    y0 + box.y * ph,
    x0 + (box.x + box.w) * pw,
    y0 + (box.y + box.h) * ph,
  ];
}

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
