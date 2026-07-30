import { describe, it, expect } from 'vitest';
import { parseAmount, parseDate, parseReceipt, EN_KEYWORDS, type ReceiptData } from './receipt.lib';
import type { OcrResult, OcrLine } from './ocr.lib';

// Build an OcrResult from [text, y] pairs (x=0, fixed size). y drives layout.
function ocr(rows: [string, number][]): OcrResult {
  const lines: OcrLine[] = rows.map(([text, y]) => ({
    text,
    box: { x: 0, y, width: 100, height: 12 },
    confidence: 0.9,
  }));
  return { text: rows.map((r) => r[0]).join('\n'), lines, backend: 'wasm' };
}

describe('parseAmount', () => {
  const cases: [string, number | null][] = [
    ['$12.34', 12.34],
    ['TOTAL 1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['12,50', 12.5],
    ['1,234', 1234],
    ['no digits here', null],
  ];
  it.each(cases)('parses %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });
});

describe('parseDate', () => {
  it('parses ISO YYYY-MM-DD', () => {
    expect(parseDate('Date: 2026-02-01')).toEqual({ raw: '2026-02-01', iso: '2026-02-01' });
  });
  it('parses numeric dates day-first', () => {
    expect(parseDate('01/02/2026')).toEqual({ raw: '01/02/2026', iso: '2026-02-01' });
  });
  it('parses "5 Jan 2026"', () => {
    expect(parseDate('5 Jan 2026')?.iso).toBe('2026-01-05');
  });
  it('parses "Jan 5, 2026"', () => {
    expect(parseDate('Jan 5, 2026')?.iso).toBe('2026-01-05');
  });
  it('returns null when no date', () => {
    expect(parseDate('THANK YOU')).toBeNull();
  });
});

describe('parseReceipt', () => {
  it('extracts all summary fields and disambiguates total from subtotal/tax', () => {
    const result = parseReceipt(
      ocr([
        ['BLUE BOTTLE COFFEE', 0],
        ['123 Main St', 10],
        ['Date: 02/03/2026', 20],
        ['Latte $4.50', 40],
        ['Subtotal $9.00', 60],
        ['Tax $0.90', 70],
        ['TOTAL $9.90', 80],
        ['VISA ****1234', 100],
      ]),
    );
    const expected: ReceiptData = {
      merchant: 'BLUE BOTTLE COFFEE',
      dateRaw: '02/03/2026',
      dateIso: '2026-03-02',
      currency: '$',
      subtotal: 9.0,
      tax: 0.9,
      total: 9.9,
    };
    expect(result).toEqual(expected);
  });

  it('prefers "Grand Total" and handles "Amount Due" keyword variants', () => {
    const r = parseReceipt(ocr([['Amount Due USD 42.00', 50], ['Grand Total USD 42.00', 60]]));
    expect(r.total).toBe(42);
    expect(r.currency).toBe('USD');
  });

  it('returns all-null when nothing matches', () => {
    expect(parseReceipt(ocr([['xxxxx', 0], ['yyyyy', 10]]))).toEqual({
      merchant: 'xxxxx', dateRaw: null, dateIso: null, currency: null, subtotal: null, tax: null, total: null,
    });
  });

  it('accepts a custom keyword set', () => {
    const idKeywords = { ...EN_KEYWORDS, total: ['jumlah'], totalExclude: ['pajak'] };
    const r = parseReceipt(ocr([['Jumlah 15.00', 50]]), idKeywords);
    expect(r.total).toBe(15);
  });
});
