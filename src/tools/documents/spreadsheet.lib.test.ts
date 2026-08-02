import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { colLabel, readWorkbook, sheetToView, MAX_ROWS, MAX_COLS } from './spreadsheet.lib';

/** Build a .xlsx byte array from one or more named sheets (arrays of arrays). */
function makeWorkbook(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('colLabel', () => {
  it.each([
    [0, 'A'], [1, 'B'], [25, 'Z'], [26, 'AA'], [27, 'AB'], [51, 'AZ'], [52, 'BA'], [701, 'ZZ'], [702, 'AAA'],
  ])('index %i → %s', (i, label) => {
    expect(colLabel(i)).toBe(label);
  });
});

describe('readWorkbook', () => {
  it('reads every sheet with cells stringified', () => {
    const bytes = makeWorkbook({
      Alpha: [['Name', 'Age'], ['Ada', 36], ['Alan', 41]],
      Beta: [['x'], ['y']],
    });
    const views = readWorkbook(bytes, XLSX);
    expect(views.map(v => v.name)).toEqual(['Alpha', 'Beta']);
    const alpha = views[0];
    expect(alpha.rows[0]).toEqual(['Name', 'Age']);
    expect(alpha.rows[1]).toEqual(['Ada', '36']); // numbers → strings
    expect(alpha.totalRows).toBe(3);
    expect(alpha.totalCols).toBe(2);
    expect(alpha.truncated).toBe(false);
  });

  it('pads ragged rows to a rectangular grid', () => {
    const bytes = makeWorkbook({ S: [['a', 'b', 'c'], ['d']] });
    const [s] = readWorkbook(bytes, XLSX);
    expect(s.totalCols).toBe(3);
    expect(s.rows[1]).toEqual(['d', '', '']); // short row padded with empty strings
  });
});

describe('cell formatting', () => {
  it('renders dates as text, not a raw serial number', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['when'], [new Date(Date.UTC(2024, 0, 15))]], { cellDates: true });
    const view = sheetToView('D', sheet, XLSX);
    const cell = view.rows[1][0];
    expect(cell).not.toMatch(/^4\d{4}$/); // not the ~45306 serial for Jan 2024
    expect(cell).not.toContain('T00:00'); // not the raw ISO string
    expect(cell).toBe('1/15/24'); // Excel-formatted date text (m/d/yy)
  });
});

describe('sheetToView truncation', () => {
  it('caps rows/cols and flags truncated', () => {
    const rows = Array.from({ length: MAX_ROWS + 50 }, (_, r) => [r, r * 2]);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const view = sheetToView('Big', sheet, XLSX);
    expect(view.totalRows).toBe(MAX_ROWS + 50);
    expect(view.rows.length).toBe(MAX_ROWS); // rendered rows capped
    expect(view.truncated).toBe(true);
  });

  it('caps columns beyond MAX_COLS', () => {
    const wide = [Array.from({ length: MAX_COLS + 10 }, (_, c) => `c${c}`)];
    const sheet = XLSX.utils.aoa_to_sheet(wide);
    const view = sheetToView('Wide', sheet, XLSX);
    expect(view.totalCols).toBe(MAX_COLS + 10);
    expect(view.rows[0].length).toBe(MAX_COLS);
    expect(view.truncated).toBe(true);
  });
});
