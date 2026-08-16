import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { computeInvoice, formatMoney, CURRENCIES, type InvoiceItem } from '@/tools/dev/invoice.lib';
import { terbilangRupiah } from '@/tools/dev/terbilang.lib';
import type { Lang } from '@/i18n/config';

interface Field { description: string; qty: string; unitPrice: string; }

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Create a clean invoice and save it as PDF — add your details, line items, tax (PPN) and a discount, then print or save. Everything is generated in your browser; nothing is uploaded.',
    currency: 'Currency', number: 'Invoice #', date: 'Date', due: 'Due date',
    from: 'From', to: 'Bill to', namePlaceholder: 'Name / company', detailPlaceholder: 'Address, email, phone…',
    items: 'Items', desc: 'Description', qty: 'Qty', price: 'Unit price', amount: 'Amount', addItem: 'Add item',
    discount: 'Discount %', tax: 'Tax / PPN %', notes: 'Notes',
    subtotal: 'Subtotal', discountL: 'Discount', taxL: 'Tax', total: 'Total', inWords: 'In words',
    print: 'Print / Save as PDF', invoice: 'INVOICE', notesPlaceholder: 'Payment terms, bank account…',
  },
  id: {
    intro: 'Buat invoice rapi dan simpan sebagai PDF — tambahkan detail Anda, item, pajak (PPN), dan diskon, lalu cetak atau simpan. Semuanya dibuat di browser Anda; tidak ada yang diunggah.',
    currency: 'Mata uang', number: 'No. Invoice', date: 'Tanggal', due: 'Jatuh tempo',
    from: 'Dari', to: 'Ditagihkan ke', namePlaceholder: 'Nama / perusahaan', detailPlaceholder: 'Alamat, email, telepon…',
    items: 'Item', desc: 'Deskripsi', qty: 'Qty', price: 'Harga satuan', amount: 'Jumlah', addItem: 'Tambah item',
    discount: 'Diskon %', tax: 'Pajak / PPN %', notes: 'Catatan',
    subtotal: 'Subtotal', discountL: 'Diskon', taxL: 'Pajak', total: 'Total', inWords: 'Terbilang',
    print: 'Cetak / Simpan PDF', invoice: 'INVOICE', notesPlaceholder: 'Syarat pembayaran, rekening…',
  },
};

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export default function InvoiceGenerator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [currency, setCurrency] = useState('IDR');
  const [number, setNumber] = useState('INV-001');
  const [date, setDate] = useState('');
  const [due, setDue] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromDetail, setFromDetail] = useState('');
  const [toName, setToName] = useState('');
  const [toDetail, setToDetail] = useState('');
  const [items, setItems] = useState<Field[]>([{ description: '', qty: '1', unitPrice: '' }]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [taxPercent, setTaxPercent] = useState('11');
  const [notes, setNotes] = useState('');

  const parsed: InvoiceItem[] = useMemo(
    () => items.map(it => ({ description: it.description, qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0 })),
    [items],
  );
  const totals = useMemo(
    () => computeInvoice(parsed, { discountPercent: Number(discountPercent) || 0, taxPercent: Number(taxPercent) || 0 }),
    [parsed, discountPercent, taxPercent],
  );
  const money = (v: number) => formatMoney(v, currency);

  const setItem = (i: number, key: keyof Field, value: string) =>
    setItems(list => list.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const addItem = () => setItems(list => [...list, { description: '', qty: '1', unitPrice: '' }]);
  const removeItem = (i: number) => setItems(list => (list.length > 1 ? list.filter((_, idx) => idx !== i) : list));

  const rowsHtml = parsed
    .filter(it => it.description || it.qty || it.unitPrice)
    .map(it => `<tr><td>${esc(it.description)}</td><td class="r">${it.qty}</td><td class="r">${esc(money(it.unitPrice))}</td><td class="r">${esc(money(it.qty * it.unitPrice))}</td></tr>`)
    .join('');

  const buildHtml = () => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(number || 'invoice')}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:0;padding:32px;font-size:13px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
  h1{font-size:28px;letter-spacing:2px;margin:0} .muted{color:#666} .meta{text-align:right}
  .parties{display:flex;gap:40px;margin-bottom:24px} .parties>div{flex:1}
  .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}
  .name{font-weight:700} .detail{white-space:pre-line;color:#444}
  table{width:100%;border-collapse:collapse;margin-bottom:16px} th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}
  th{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888} .r{text-align:right}
  .totals{margin-left:auto;width:280px} .totals td{border:none;padding:4px 8px} .grand{font-weight:700;font-size:16px;border-top:2px solid #111!important}
  .words{font-style:italic;color:#444;margin-top:8px} .notes{margin-top:24px;white-space:pre-line;color:#444}
</style></head><body>
  <div class="head"><div><h1>${esc(t.invoice)}</h1><div class="muted">${esc(number)}</div></div>
  <div class="meta"><div>${esc(t.date)}: ${esc(date)}</div><div>${esc(t.due)}: ${esc(due)}</div></div></div>
  <div class="parties">
    <div><div class="label">${esc(t.from)}</div><div class="name">${esc(fromName)}</div><div class="detail">${esc(fromDetail)}</div></div>
    <div><div class="label">${esc(t.to)}</div><div class="name">${esc(toName)}</div><div class="detail">${esc(toDetail)}</div></div>
  </div>
  <table><thead><tr><th>${esc(t.desc)}</th><th class="r">${esc(t.qty)}</th><th class="r">${esc(t.price)}</th><th class="r">${esc(t.amount)}</th></tr></thead><tbody>${rowsHtml}</tbody></table>
  <table class="totals">
    <tr><td>${esc(t.subtotal)}</td><td class="r">${esc(money(totals.subtotal))}</td></tr>
    ${totals.discountAmount ? `<tr><td>${esc(t.discountL)}</td><td class="r">- ${esc(money(totals.discountAmount))}</td></tr>` : ''}
    ${totals.taxAmount ? `<tr><td>${esc(t.taxL)} (${esc(taxPercent)}%)</td><td class="r">${esc(money(totals.taxAmount))}</td></tr>` : ''}
    <tr class="grand"><td>${esc(t.total)}</td><td class="r">${esc(money(totals.total))}</td></tr>
  </table>
  ${currency === 'IDR' ? `<div class="words">${esc(t.inWords)}: ${esc(terbilangRupiah(Math.round(totals.total)))}</div>` : ''}
  ${notes ? `<div class="notes"><div class="label">${esc(t.notes)}</div>${esc(notes)}</div>` : ''}
</body></html>`;

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildHtml());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const input = 'w-full border-2 border-border bg-muted p-2 text-sm';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs"><span className="font-semibold">{t.currency}</span>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={input}>
                {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs"><span className="font-semibold">{t.number}</span>
              <input value={number} onChange={e => setNumber(e.target.value)} className={input} /></label>
            <label className="space-y-1 text-xs"><span className="font-semibold">{t.date}</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} /></label>
            <label className="space-y-1 text-xs"><span className="font-semibold">{t.due}</span>
              <input type="date" value={due} onChange={e => setDue(e.target.value)} className={input} /></label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1 text-xs"><span className="font-semibold">{t.from}</span>
              <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder={t.namePlaceholder} className={input} />
              <textarea value={fromDetail} onChange={e => setFromDetail(e.target.value)} placeholder={t.detailPlaceholder} rows={3} className={input} /></div>
            <div className="space-y-1 text-xs"><span className="font-semibold">{t.to}</span>
              <input value={toName} onChange={e => setToName(e.target.value)} placeholder={t.namePlaceholder} className={input} />
              <textarea value={toDetail} onChange={e => setToDetail(e.target.value)} placeholder={t.detailPlaceholder} rows={3} className={input} /></div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold">{t.items}</span>
            {items.map((it, i) => (
              <div key={i} className="flex gap-1">
                <input value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder={t.desc} className={`${input} flex-1`} />
                <input value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} inputMode="decimal" placeholder={t.qty} className={`${input} w-14`} />
                <input value={it.unitPrice} onChange={e => setItem(i, 'unitPrice', e.target.value)} inputMode="decimal" placeholder={t.price} className={`${input} w-24`} />
                <button onClick={() => removeItem(i)} aria-label="remove" className="border-2 border-border px-2 text-sm">×</button>
              </div>
            ))}
            <Button variant="secondary" onClick={addItem} className="text-xs">+ {t.addItem}</Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs"><span className="font-semibold">{t.discount}</span>
              <input value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} inputMode="decimal" className={input} /></label>
            <label className="space-y-1 text-xs"><span className="font-semibold">{t.tax}</span>
              <input value={taxPercent} onChange={e => setTaxPercent(e.target.value)} inputMode="decimal" className={input} /></label>
          </div>
          <label className="space-y-1 text-xs block"><span className="font-semibold">{t.notes}</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t.notesPlaceholder} rows={2} className={input} /></label>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <div className="border-2 border-border bg-white p-4 text-sm text-black">
            <div className="flex items-start justify-between">
              <div><div className="text-2xl font-black tracking-widest">{t.invoice}</div><div className="text-gray-500">{number}</div></div>
              <div className="text-right text-xs text-gray-600"><div>{t.date}: {date || '—'}</div><div>{t.due}: {due || '—'}</div></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div><div className="uppercase tracking-wide text-gray-400">{t.from}</div><div className="font-bold">{fromName || '—'}</div><div className="whitespace-pre-line text-gray-600">{fromDetail}</div></div>
              <div><div className="uppercase tracking-wide text-gray-400">{t.to}</div><div className="font-bold">{toName || '—'}</div><div className="whitespace-pre-line text-gray-600">{toDetail}</div></div>
            </div>
            <table className="mt-4 w-full text-xs">
              <thead><tr className="border-b border-gray-300 text-left text-gray-400">
                <th className="py-1">{t.desc}</th><th className="py-1 text-right">{t.qty}</th><th className="py-1 text-right">{t.price}</th><th className="py-1 text-right">{t.amount}</th></tr></thead>
              <tbody>
                {parsed.filter(it => it.description || it.unitPrice).map((it, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1">{it.description}</td><td className="py-1 text-right">{it.qty}</td>
                    <td className="py-1 text-right">{money(it.unitPrice)}</td><td className="py-1 text-right">{money(it.qty * it.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 ml-auto w-56 text-xs">
              <div className="flex justify-between py-0.5"><span>{t.subtotal}</span><span>{money(totals.subtotal)}</span></div>
              {totals.discountAmount > 0 && <div className="flex justify-between py-0.5"><span>{t.discountL}</span><span>- {money(totals.discountAmount)}</span></div>}
              {totals.taxAmount > 0 && <div className="flex justify-between py-0.5"><span>{t.taxL} ({taxPercent}%)</span><span>{money(totals.taxAmount)}</span></div>}
              <div className="mt-1 flex justify-between border-t-2 border-black py-1 text-sm font-black"><span>{t.total}</span><span>{money(totals.total)}</span></div>
            </div>
            {currency === 'IDR' && totals.total > 0 && <div className="mt-2 text-xs italic text-gray-600">{t.inWords}: {terbilangRupiah(Math.round(totals.total))}</div>}
          </div>
          <Button onClick={print}>{t.print}</Button>
        </div>
      </div>
    </div>
  );
}
