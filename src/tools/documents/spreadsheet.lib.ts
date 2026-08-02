import type * as XLSXType from 'xlsx';

/**
 * Row/column caps for what we render. A workbook is parsed in full (so totals are
 * accurate), but only this many cells are turned into DOM to keep large sheets
 * responsive. `truncated` tells the UI to show a "showing first N" notice.
 */
export const MAX_ROWS = 500;
export const MAX_COLS = 60;

export interface SheetView {
  name: string;
  /** Capped, rectangular grid of stringified cells (rows × totalCols, both bounded). */
  rows: string[][];
  /** True used-range row count (before capping). */
  totalRows: number;
  /** True used-range column count (before capping). */
  totalCols: number;
  /** True when the sheet exceeds MAX_ROWS or MAX_COLS and the grid was capped. */
  truncated: boolean;
}

/** Bijective base-26 spreadsheet column label: 0→A, 25→Z, 26→AA, 701→ZZ. */
export function colLabel(index: number): string {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Convert one parsed worksheet into a capped, rectangular string grid. */
export function sheetToView(name: string, sheet: XLSXType.WorkSheet, XLSX: typeof XLSXType): SheetView {
  // raw: false → cells come back as their *formatted* text (dates, currency and
  // percentages render as they appeared in Excel, not as raw serial numbers).
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '', raw: false }) as unknown[][];
  const totalRows = aoa.length;
  const totalCols = aoa.reduce((m, r) => Math.max(m, r.length), 0);
  const truncated = totalRows > MAX_ROWS || totalCols > MAX_COLS;
  const cols = Math.min(totalCols, MAX_COLS);
  const rows = aoa.slice(0, MAX_ROWS).map((r) =>
    Array.from({ length: cols }, (_, c) => {
      const v = r[c];
      return v == null ? '' : String(v);
    }),
  );
  return { name, rows, totalRows, totalCols, truncated };
}

/**
 * Parse spreadsheet bytes (.xlsx/.xlsm/.xls/.ods/.csv — anything SheetJS sniffs)
 * into per-sheet views. `XLSX` is injected so the ~900KB engine stays a lazy,
 * dynamically-imported dependency of the island, not a static one.
 */
export function readWorkbook(bytes: Uint8Array, XLSX: typeof XLSXType): SheetView[] {
  const wb = XLSX.read(bytes, { type: 'array', cellDates: true });
  return wb.SheetNames.map((name) => sheetToView(name, wb.Sheets[name], XLSX));
}
