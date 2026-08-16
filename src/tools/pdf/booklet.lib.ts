/**
 * Pure saddle-stitch booklet imposition order. Given a page count, returns the
 * sequence of 1-based source page numbers to place two-up on each sheet side so
 * that, once printed double-sided and folded, the pages read in order. 0 marks a
 * blank (padding) page. The actual PDF assembly (via pdf-lib) lives in the island.
 */

/** Round a page count up to the nearest multiple of 4 (a full saddle-stitch sheet). */
export function paddedCount(pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.ceil(pageCount / 4) * 4;
}

export function bookletOrder(pageCount: number): number[] {
  if (pageCount <= 0) return [];
  const total = paddedCount(pageCount);
  const order: number[] = [];
  let left = total;
  let right = 1;
  while (right < left) {
    order.push(left, right); // front side of the sheet
    right++; left--;
    order.push(right, left); // back side of the sheet
    right++; left--;
  }
  // Pages beyond the real count are blanks.
  return order.map(p => (p <= pageCount ? p : 0));
}
