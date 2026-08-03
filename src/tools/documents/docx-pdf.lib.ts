/**
 * Geometry helpers for the DOCX→PDF converter. docx-preview lays each page out
 * in CSS pixels; a PDF works in points (1pt = 1/72 inch, and CSS assumes 96px =
 * 1 inch), so we convert page dimensions here. Kept pure and unit-tested; the
 * rasterization (html2canvas) and assembly (pdf-lib) live in the island.
 */

/** CSS pixels → PDF points. Default 96 DPI is the CSS reference pixel density. */
export function pxToPt(px: number, dpi = 96): number {
  return (px * 72) / dpi;
}

/** A rendered page's pixel box → its [width, height] in PDF points (2 dp). */
export function pageSizePt(widthPx: number, heightPx: number, dpi = 96): [number, number] {
  const round = (n: number) => Math.round(pxToPt(n, dpi) * 100) / 100;
  return [round(widthPx), round(heightPx)];
}
