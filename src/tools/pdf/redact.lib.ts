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

/** Zoom bounds for the redaction preview (1 = fit-to-viewport baseline). */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;

/** Clamp a zoom multiplier to the allowed range and snap it onto the step grid,
 * so repeated +/- presses never drift off a clean value. */
export function clampZoom(z: number): number {
  const snapped = Math.round(z / ZOOM_STEP) * ZOOM_STEP;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, snapped));
}

/** Scale that fits a rendered page fully inside the viewport, never upscaling
 * past its native pixels. Returns 1 while either size is still unmeasured, so the
 * preview falls back to plain CSS fit without a flash. */
export function fitScale(
  natural: { w: number; h: number },
  viewport: { w: number; h: number },
): number {
  if (natural.w <= 0 || natural.h <= 0) return 1;
  const byW = viewport.w > 0 ? viewport.w / natural.w : Infinity;
  const byH = viewport.h > 0 ? viewport.h / natural.h : Infinity;
  const s = Math.min(byW, byH);
  return Number.isFinite(s) ? Math.min(s, 1) : 1;
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
