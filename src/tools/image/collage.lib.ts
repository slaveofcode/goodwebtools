/** Pure grid-layout math for the Photo Collage tool. */

export interface Cell { index: number; x: number; y: number; w: number; h: number }

/**
 * Lay out `count` cells in a grid of `cols` columns within a `width`×`height`
 * canvas, separated (and bordered) by `gap` pixels. The last row may be partly
 * empty but cells keep a uniform size.
 */
export function gridLayout(count: number, cols: number, width: number, height: number, gap: number): Cell[] {
  if (count <= 0 || cols <= 0) return [];
  const rows = Math.ceil(count / cols);
  const cellW = (width - gap * (cols + 1)) / cols;
  const cellH = (height - gap * (rows + 1)) / rows;
  const cells: Cell[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    cells.push({ index: i, x: gap + c * (cellW + gap), y: gap + r * (cellH + gap), w: cellW, h: cellH });
  }
  return cells;
}
