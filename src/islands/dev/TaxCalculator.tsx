import { useMemo, useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { computePpn, computePph, PPN_RATES, PPH_PRESETS } from '@/tools/dev/tax.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string;
  amount: string;
  ppnRate: string;
  inclusive: string;
  pph: string;
  none: string;
  dpp: string;
  ppn: string;
  invoiceTotal: string;
  pphWithheld: string;
  netToVendor: string;
}> = {
  en: {
    intro: 'Calculate PPN (VAT) and PPh (withholding) on an invoice amount. Everything is computed in your browser.',
    amount: 'Amount (Rp)',
    ppnRate: 'PPN rate',
    inclusive: 'Amount already includes PPN',
    pph: 'PPh withholding',
    none: 'None',
    dpp: 'Base (DPP)',
    ppn: 'PPN',
    invoiceTotal: 'Invoice total (DPP + PPN)',
    pphWithheld: 'PPh withheld',
    netToVendor: 'Net paid to vendor',
  },
  id: {
    intro: 'Hitung PPN dan PPh (potongan) pada nilai invoice. Semua dihitung di browser Anda.',
    amount: 'Nominal (Rp)',
    ppnRate: 'Tarif PPN',
    inclusive: 'Nominal sudah termasuk PPN',
    pph: 'Potongan PPh',
    none: 'Tidak ada',
    dpp: 'Dasar (DPP)',
    ppn: 'PPN',
    invoiceTotal: 'Total invoice (DPP + PPN)',
    pphWithheld: 'PPh dipotong',
    netToVendor: 'Diterima vendor',
  },
};

const rp = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n);

export default function TaxCalculator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [amount, setAmount] = useState('1000000');
  const [ppnRate, setPpnRate] = useState(11);
  const [inclusive, setInclusive] = useState(false);
  const [pphRate, setPphRate] = useState(0);

  const result = useMemo(() => {
    const value = Number(amount.replace(/[.,\s]/g, ''));
    if (!Number.isFinite(value) || value <= 0) return null;
    const ppn = computePpn(value, ppnRate / 100, inclusive);
    const pph = pphRate > 0 ? computePph(ppn.dpp, pphRate) : { pph: 0, net: ppn.dpp };
    return { ...ppn, pphAmount: pph.pph, net: ppn.total - pph.pph };
  }, [amount, ppnRate, inclusive, pphRate]);

  const rows = result
    ? [
        { label: t.dpp, value: rp(result.dpp) },
        { label: t.ppn, value: rp(result.ppn) },
        { label: t.invoiceTotal, value: rp(result.total), strong: true },
        ...(pphRate > 0 ? [{ label: t.pphWithheld, value: '− ' + rp(result.pphAmount) }] : []),
        ...(pphRate > 0 ? [{ label: t.netToVendor, value: rp(result.net), strong: true }] : []),
      ]
    : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <label className="block space-y-1">
        <span className="block text-sm font-semibold">{t.amount}</span>
        <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" spellCheck={false}
          className="w-full border-2 border-border bg-muted p-3 font-mono text-lg" placeholder="1000000" />
      </label>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.ppnRate}</span>
          <select value={ppnRate} onChange={e => setPpnRate(Number(e.target.value))}
            className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            {PPN_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={inclusive} onChange={e => setInclusive(e.target.checked)} className="h-4 w-4 accent-accent" />
          {t.inclusive}
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="block font-semibold">{t.pph}</span>
        <select value={pphRate} onChange={e => setPphRate(Number(e.target.value))}
          className="w-full max-w-md border-2 border-border bg-background px-2 py-1.5 text-sm">
          <option value={0}>{t.none}</option>
          {PPH_PRESETS.map(p => <option key={p.label} value={p.rate}>{p.label}</option>)}
        </select>
      </label>

      {result && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <CopyButton value={rows.map(r => `${r.label}: ${r.value}`).join('\n')} />
          </div>
          <div className="divide-y divide-border border-2 border-border">
            {rows.map(r => (
              <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-sm">
                <span className="font-medium text-muted-foreground">{r.label}</span>
                <span className={`font-mono ${r.strong ? 'text-base font-bold' : ''}`}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
