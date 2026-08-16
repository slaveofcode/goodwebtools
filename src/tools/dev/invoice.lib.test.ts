import { describe, it, expect } from 'vitest';
import { computeInvoice, formatMoney, type InvoiceItem } from './invoice.lib';

const items: InvoiceItem[] = [
  { description: 'Design', qty: 2, unitPrice: 100 },
  { description: 'Hosting', qty: 1, unitPrice: 50 },
];

describe('computeInvoice', () => {
  it('sums line items into a subtotal', () => {
    const r = computeInvoice(items, {});
    expect(r.subtotal).toBe(250);
    expect(r.total).toBe(250);
  });

  it('applies tax on the subtotal', () => {
    const r = computeInvoice(items, { taxPercent: 11 });
    expect(r.taxAmount).toBeCloseTo(27.5, 6);
    expect(r.total).toBeCloseTo(277.5, 6);
  });

  it('applies a discount before tax', () => {
    const r = computeInvoice(items, { discountPercent: 10, taxPercent: 11 });
    expect(r.discountAmount).toBeCloseTo(25, 6);
    expect(r.taxableBase).toBeCloseTo(225, 6);
    expect(r.taxAmount).toBeCloseTo(24.75, 6);
    expect(r.total).toBeCloseTo(249.75, 6);
  });

  it('ignores blank/invalid rows', () => {
    const r = computeInvoice([{ description: '', qty: 0, unitPrice: 0 }, { description: 'X', qty: 3, unitPrice: 10 }], {});
    expect(r.subtotal).toBe(30);
  });

  it('is all zero for no items', () => {
    const r = computeInvoice([], { taxPercent: 11 });
    expect(r).toEqual({ subtotal: 0, discountAmount: 0, taxableBase: 0, taxAmount: 0, total: 0 });
  });
});

describe('formatMoney', () => {
  it('formats IDR without decimals', () => {
    expect(formatMoney(1500000, 'IDR')).toBe('Rp 1.500.000');
  });
  it('formats USD with two decimals', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50');
  });
});
