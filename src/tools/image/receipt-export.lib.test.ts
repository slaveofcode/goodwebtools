import { describe, it, expect } from 'vitest';
import { receiptToJson, receiptToCsv } from './receipt-export.lib';
import type { ReceiptData } from './receipt.lib';

const sample: ReceiptData = {
  merchant: 'Blue Bottle', dateRaw: '02/03/2026', dateIso: '2026-03-02',
  currency: '$', subtotal: 9, tax: 0.9, total: 9.9,
};

describe('receiptToJson', () => {
  it('round-trips to the same object', () => {
    expect(JSON.parse(receiptToJson(sample))).toEqual(sample);
  });
});

describe('receiptToCsv', () => {
  it('emits a header and one row', () => {
    const csv = receiptToCsv(sample);
    const [header, row] = csv.split('\n');
    expect(header).toBe('merchant,dateRaw,dateIso,currency,subtotal,tax,total');
    expect(row).toBe('Blue Bottle,02/03/2026,2026-03-02,$,9,0.9,9.9');
  });
  it('quotes and escapes fields containing commas or quotes', () => {
    const row = receiptToCsv({ ...sample, merchant: 'A, "B" Store' }).split('\n')[1];
    expect(row.startsWith('"A, ""B"" Store",')).toBe(true);
  });
  it('renders null fields as empty cells', () => {
    const row = receiptToCsv({ ...sample, tax: null, dateRaw: null }).split('\n')[1];
    expect(row).toBe('Blue Bottle,,2026-03-02,$,9,,9.9');
  });
});
