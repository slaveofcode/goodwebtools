/**
 * Pure invoice math and money formatting. UI, layout and printing live in the
 * island; the arithmetic and currency rendering are here and unit-tested.
 */

export interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface InvoiceOptions {
  discountPercent?: number;
  taxPercent?: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  taxAmount: number;
  total: number;
}

export function computeInvoice(items: InvoiceItem[], opts: InvoiceOptions): InvoiceTotals {
  const subtotal = items.reduce((sum, it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const discountAmount = subtotal * ((opts.discountPercent || 0) / 100);
  const taxableBase = subtotal - discountAmount;
  const taxAmount = taxableBase * ((opts.taxPercent || 0) / 100);
  return {
    subtotal,
    discountAmount,
    taxableBase,
    taxAmount,
    total: taxableBase + taxAmount,
  };
}

interface CurrencyDef { symbol: string; locale: string; digits: number; after: boolean; }

export const CURRENCIES: Record<string, CurrencyDef> = {
  IDR: { symbol: 'Rp ', locale: 'id-ID', digits: 0, after: false },
  USD: { symbol: '$', locale: 'en-US', digits: 2, after: false },
  EUR: { symbol: '€', locale: 'en-IE', digits: 2, after: false },
  GBP: { symbol: '£', locale: 'en-GB', digits: 2, after: false },
  SGD: { symbol: 'S$', locale: 'en-SG', digits: 2, after: false },
  MYR: { symbol: 'RM ', locale: 'ms-MY', digits: 2, after: false },
};

/** Format a value with the currency's symbol and locale grouping (deterministic). */
export function formatMoney(value: number, currency: string): string {
  const c = CURRENCIES[currency] ?? CURRENCIES.USD;
  const num = new Intl.NumberFormat(c.locale, {
    minimumFractionDigits: c.digits,
    maximumFractionDigits: c.digits,
  }).format(value);
  return c.after ? `${num} ${c.symbol}` : `${c.symbol}${num}`;
}
