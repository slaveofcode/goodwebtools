import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import type { ReceiptData } from '@/tools/image/receipt.lib';
import { receiptToJson, receiptToCsv } from '@/tools/image/receipt-export.lib';

const FIELDS: { key: keyof ReceiptData; label: string }[] = [
  { key: 'merchant', label: 'Merchant' },
  { key: 'dateRaw', label: 'Date (as printed)' },
  { key: 'dateIso', label: 'Date (ISO)' },
  { key: 'currency', label: 'Currency' },
  { key: 'subtotal', label: 'Subtotal' },
  { key: 'tax', label: 'Tax' },
  { key: 'total', label: 'Total' },
];

// Editable string form of ReceiptData.
type Form = Record<keyof ReceiptData, string>;

function toForm(d: ReceiptData): Form {
  return {
    merchant: d.merchant ?? '', dateRaw: d.dateRaw ?? '', dateIso: d.dateIso ?? '',
    currency: d.currency ?? '', subtotal: d.subtotal?.toString() ?? '',
    tax: d.tax?.toString() ?? '', total: d.total?.toString() ?? '',
  };
}

function toData(f: Form): ReceiptData {
  const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s));
  const str = (s: string) => (s.trim() === '' ? null : s);
  return {
    merchant: str(f.merchant), dateRaw: str(f.dateRaw), dateIso: str(f.dateIso),
    currency: str(f.currency), subtotal: num(f.subtotal), tax: num(f.tax), total: num(f.total),
  };
}

export default function ReceiptFields({ data }: { data: ReceiptData }) {
  const [form, setForm] = useState<Form>(() => toForm(data));
  useEffect(() => { setForm(toForm(data)); }, [data]);

  const set = (key: keyof ReceiptData, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const current = toData(form);
  const someMissing = Object.values(current).some((v) => v === null);

  const downloadJson = () => downloadService.download(new Blob([receiptToJson(current)], { type: 'application/json' }), 'receipt.json');
  const downloadCsv = () => downloadService.download(new Blob([receiptToCsv(current)], { type: 'text/csv' }), 'receipt.csv');

  return (
    <div className="space-y-3 border-2 border-border p-3">
      <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Receipt fields</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="space-y-1 text-sm">
            <span className="block font-bold text-muted-foreground">{label}</span>
            <input
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              className="w-full border-2 border-border bg-muted px-2 py-1.5 outline-none focus:shadow-brutal-sm"
            />
          </label>
        ))}
      </div>
      {someMissing && (
        <p className="text-xs text-muted-foreground">Some fields couldn’t be detected — fill them in above.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={downloadJson}>Download JSON</Button>
        <Button variant="secondary" onClick={downloadCsv}>Download CSV</Button>
        <CopyButton value={receiptToJson(current)} label="Copy JSON" />
      </div>
    </div>
  );
}
