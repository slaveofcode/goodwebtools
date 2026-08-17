/**
 * Pure helpers for best-effort PDF-to-table extraction: cluster positioned text
 * items into rows (by y) and emit CSV. The pdf.js text extraction runs in the
 * island. This is a heuristic — it works well for simple, grid-like tables and
 * less well for complex layouts.
 */

export interface TextItem {
  str: string;
  x: number;
  y: number;
}

/** Group items into rows by their y position (PDF y increases upward). */
export function groupRows(items: TextItem[], yTolerance: number): TextItem[][] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: TextItem[][] = [];
  let current: TextItem[] = [];
  let rowY = sorted[0].y;
  for (const item of sorted) {
    if (current.length === 0 || Math.abs(item.y - rowY) <= yTolerance) {
      current.push(item);
    } else {
      rows.push(current.sort((a, b) => a.x - b.x));
      current = [item];
      rowY = item.y;
    }
  }
  if (current.length) rows.push(current.sort((a, b) => a.x - b.x));
  return rows;
}

function escapeCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Emit CSV from grouped rows (each item is a cell, in x order). */
export function toCsv(rows: TextItem[][]): string {
  return rows.map(row => row.map(c => escapeCell(c.str)).join(',')).join('\n');
}
