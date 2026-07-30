import type { ReceiptData } from './receipt.lib';

const FIELDS: (keyof ReceiptData)[] = ['merchant', 'dateRaw', 'dateIso', 'currency', 'subtotal', 'tax', 'total'];

export function receiptToJson(d: ReceiptData): string {
  return JSON.stringify(d, null, 2);
}

function csvCell(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function receiptToCsv(d: ReceiptData): string {
  const header = FIELDS.join(',');
  const row = FIELDS.map((f) => csvCell(d[f])).join(',');
  return `${header}\n${row}`;
}
