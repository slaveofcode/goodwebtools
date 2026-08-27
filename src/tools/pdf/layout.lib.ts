/**
 * Pure geometry helpers for the Organize-PDF and Sign-PDF tools. No PDF engine
 * dependency, so these can be unit-tested in isolation. pdf-lib's coordinate
 * origin is the bottom-left of the page.
 */

export type PageNumberPosition =
  | 'bottom-center' | 'bottom-right' | 'bottom-left'
  | 'top-center' | 'top-right' | 'top-left';

export interface PageNumberOptions {
  enabled: boolean;
  position: PageNumberPosition;
  startAt: number;
  fontSize: number; // points
  margin: number; // points
}

/** Bottom-left {x,y} for a page-number label of the given rendered width. */
export function pageNumberXY(
  position: PageNumberPosition,
  pageW: number,
  pageH: number,
  textWidth: number,
  fontSize: number,
  margin: number,
): { x: number; y: number } {
  const y = position.startsWith('top') ? pageH - margin - fontSize : margin;
  let x: number;
  if (position.endsWith('center')) x = pageW / 2 - textWidth / 2;
  else if (position.endsWith('right')) x = pageW - margin - textWidth;
  else x = margin;
  return { x, y };
}

/** A signature placement in screen space (top-left origin, page-relative ratios). */
export interface SignPlacement {
  pageIndex: number;
  /** left edge, fraction of page width */
  xRatio: number;
  /** top edge, fraction of page height (measured from the top) */
  yRatio: number;
  /** width, fraction of page width */
  wRatio: number;
}

/** Fill a page-number template, e.g. "Page {n} of {total}" → "Page 3 of 10". */
export function formatPageLabel(template: string, n: number, total: number): string {
  return template.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total));
}

/** A line of typed text placed on a page (top-left origin, page-relative ratios). */
export interface TextPlacement {
  pageIndex: number;
  /** left edge, fraction of page width */
  xRatio: number;
  /** top edge of the text, fraction of page height (from the top) */
  yRatio: number;
  /** the text to draw */
  text: string;
  /** font size as a fraction of page height */
  sizeRatio: number;
}

/**
 * Convert a top-left-origin text placement into pdf-lib draw coordinates.
 * pdf-lib's `drawText` y is the text baseline and its origin is bottom-left, so
 * the baseline sits one font-size below the top edge of the text box.
 */
export function textPlacementToPdf(
  p: TextPlacement,
  pageW: number,
  pageH: number,
): { x: number; y: number; size: number } {
  const size = p.sizeRatio * pageH;
  const x = p.xRatio * pageW;
  const yFromTop = p.yRatio * pageH;
  return { x, y: pageH - yFromTop - size, size };
}

/**
 * Convert a top-left-origin ratio placement into a pdf-lib bottom-left rect.
 * Height is derived from the image aspect ratio (w/h).
 */
export function placementToPdfRect(
  p: SignPlacement,
  pageW: number,
  pageH: number,
  imgAspect: number,
): { x: number; y: number; width: number; height: number } {
  const width = p.wRatio * pageW;
  const height = width / imgAspect;
  const x = p.xRatio * pageW;
  const yFromTop = p.yRatio * pageH;
  return { x, y: pageH - yFromTop - height, width, height };
}
