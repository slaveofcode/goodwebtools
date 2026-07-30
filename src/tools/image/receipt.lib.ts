import type { OcrResult, OcrLine } from './ocr.lib';

export interface ReceiptData {
  merchant: string | null;
  dateRaw: string | null;
  dateIso: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
}

export interface ReceiptKeywords {
  total: string[];
  totalExclude: string[];
  subtotal: string[];
  tax: string[];
}

export const EN_KEYWORDS: ReceiptKeywords = {
  total: ['grand total', 'amount due', 'balance due', 'total'],
  totalExclude: ['subtotal', 'sub total', 'tax', 'vat', 'gst'],
  subtotal: ['subtotal', 'sub total'],
  tax: ['tax', 'vat', 'gst'],
};

// The (?!\d) lookaheads stop a token being cut mid-number (e.g. "1,234" must not
// match as "1,23" + "4"); the thousands-only alternative then wins for "1,234".
const NUMBER_RE = /\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?!\d)|\d+[.,]\d{2}(?!\d)|\d{1,3}(?:[.,]\d{3})+(?!\d)|\d+(?!\d)/g;

// Normalize a single numeric token (handles 1,234.56 / 1.234,56 / 12,50 / 1,234 / 12).
function normalizeNumber(tok: string): number | null {
  let s = tok;
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = /,\d{2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes('.')) {
    if (!/\.\d{2}$/.test(s)) s = s.replace(/\./g, ''); // dots are thousands unless 2 trailing digits
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Extract a monetary amount from a line: prefer a 2-decimal (money) token, else the largest number. */
export function parseAmount(text: string): number | null {
  const tokens = text.match(NUMBER_RE);
  if (!tokens) return null;
  const money = tokens.filter((t) => /[.,]\d{2}$/.test(t));
  if (money.length) return normalizeNumber(money[money.length - 1]);
  const nums = tokens.map(normalizeNumber).filter((n): n is number => n !== null);
  return nums.length ? Math.max(...nums) : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');
const normYear = (y: string) => (Number(y) < 100 ? 2000 + Number(y) : Number(y));

/** Detect a date; ambiguous numeric dates are read day-first (DD/MM/YYYY). */
export function parseDate(text: string): { raw: string; iso: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
    return { raw: m[0], iso: `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` };
  }
  if ((m = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/))) {
    return { raw: m[0], iso: `${normYear(m[3])}-${pad(+m[2])}-${pad(+m[1])}` };
  }
  if ((m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})\b/))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return { raw: m[0], iso: `${m[3]}-${pad(mo)}-${pad(+m[1])}` };
  }
  if ((m = text.match(/\b([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})\b/))) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return { raw: m[0], iso: `${m[3]}-${pad(mo)}-${pad(+m[2])}` };
  }
  return null;
}

function hasAny(text: string, kws: string[]): boolean {
  const t = text.toLowerCase();
  return kws.some((k) => t.includes(k));
}

function amountOnKeywordLine(lines: OcrLine[], kws: string[], exclude: string[] = []): OcrLine[] {
  return lines.filter((l) => hasAny(l.text, kws) && !hasAny(l.text, exclude) && parseAmount(l.text) !== null);
}

function findTotal(lines: OcrLine[], kw: ReceiptKeywords): number | null {
  const cands = amountOnKeywordLine(lines, kw.total, kw.totalExclude);
  if (!cands.length) return null;
  cands.sort((a, b) => b.box.y - a.box.y || (parseAmount(b.text)! - parseAmount(a.text)!));
  return parseAmount(cands[0].text);
}

function firstAmount(lines: OcrLine[], kws: string[]): number | null {
  const c = amountOnKeywordLine(lines, kws);
  return c.length ? parseAmount(c[0].text) : null;
}

const CURRENCY_RE = /([$€£¥₹])|\b(USD|EUR|GBP|JPY|IDR|Rp)\b/i;
function findCurrency(lines: OcrLine[]): string | null {
  for (const l of lines) {
    const m = l.text.match(CURRENCY_RE);
    if (m) return m[1] ?? m[2];
  }
  return null;
}

function isAmountOnly(text: string): boolean {
  return /^[\s$€£¥₹]*[\d.,\s]+$/.test(text.trim());
}
function findMerchant(lines: OcrLine[], kw: ReceiptKeywords): string | null {
  const sorted = [...lines].sort((a, b) => a.box.y - b.box.y);
  const skip = [...kw.total, ...kw.subtotal, ...kw.tax];
  for (const l of sorted) {
    const t = l.text.trim();
    if (!t || parseDate(t) || isAmountOnly(t) || hasAny(t, skip)) continue;
    return t;
  }
  return null;
}

// Merge a set of same-row segments into one line: text joined left-to-right,
// box spanning them all, lowest confidence kept.
function mergeRow(seg: OcrLine[]): OcrLine {
  const ordered = [...seg].sort((a, b) => a.box.x - b.box.x);
  const x = Math.min(...ordered.map((l) => l.box.x));
  const y = Math.min(...ordered.map((l) => l.box.y));
  const right = Math.max(...ordered.map((l) => l.box.x + l.box.width));
  const bottom = Math.max(...ordered.map((l) => l.box.y + l.box.height));
  return {
    text: ordered.map((l) => l.text).join(' '),
    box: { x, y, width: right - x, height: bottom - y },
    confidence: Math.min(...ordered.map((l) => l.confidence)),
  };
}

// Group detections into visual rows by vertical overlap. PP-OCR often emits a
// label and its amount as separate boxes on the same line; the finders need
// them combined so "Subtotal" and "$100.00" match as one row.
export function groupRows(lines: OcrLine[]): OcrLine[] {
  const sorted = [...lines].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const groups: OcrLine[][] = [];
  for (const l of sorted) {
    const anchor = groups[groups.length - 1]?.[0];
    const tol = anchor ? Math.min(anchor.box.height, l.box.height) * 0.6 : 0;
    if (anchor && Math.abs(l.box.y - anchor.box.y) <= tol) {
      groups[groups.length - 1].push(l);
    } else {
      groups.push([l]);
    }
  }
  return groups.map(mergeRow);
}

export function parseReceipt(ocr: OcrResult, keywords: ReceiptKeywords = EN_KEYWORDS): ReceiptData {
  const rows = groupRows(ocr.lines);
  const date = parseDate(rows.map((l) => l.text).join('\n'));
  return {
    merchant: findMerchant(rows, keywords),
    dateRaw: date?.raw ?? null,
    dateIso: date?.iso ?? null,
    currency: findCurrency(rows),
    subtotal: firstAmount(rows, keywords.subtotal),
    tax: firstAmount(rows, keywords.tax),
    total: findTotal(rows, keywords),
  };
}
