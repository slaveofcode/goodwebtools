import { useState } from 'react';
import { formatMoney } from '@/tools/dev/invoice.lib';
import { goldNisab, zakatMaal, zakatIncome } from '@/tools/calculators/zakat.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Calculate your zakat (2.5%). Enter the current gold price to set the nisab, then choose wealth (maal) or income (penghasilan). Everything is computed in your browser.',
    goldPrice: 'Gold price / gram', nisab: 'Nisab (85 g gold)',
    maal: 'Wealth (maal)', income: 'Income (penghasilan)',
    assets: 'Total assets (cash, gold, savings, investments)', liabilities: 'Debts / liabilities',
    net: 'Net wealth', monthlyIncome: 'Monthly net income', annual: 'Annual income',
    due: 'Zakat due', notDue: 'Below nisab — zakat is not obligatory (you may still give sadaqah).',
    zakat: 'Zakat (2.5%)', perMonth: 'Zakat / month', perYear: 'Zakat / year',
  },
  id: {
    intro: 'Hitung zakat Anda (2,5%). Masukkan harga emas terkini untuk menetapkan nisab, lalu pilih harta (maal) atau penghasilan. Semuanya dihitung di browser Anda.',
    goldPrice: 'Harga emas / gram', nisab: 'Nisab (85 g emas)',
    maal: 'Harta (maal)', income: 'Penghasilan',
    assets: 'Total harta (kas, emas, tabungan, investasi)', liabilities: 'Utang / kewajiban',
    net: 'Harta bersih', monthlyIncome: 'Penghasilan bersih / bulan', annual: 'Penghasilan setahun',
    due: 'Zakat wajib', notDue: 'Di bawah nisab — zakat tidak wajib (Anda tetap bisa bersedekah).',
    zakat: 'Zakat (2,5%)', perMonth: 'Zakat / bulan', perYear: 'Zakat / tahun',
  },
};

export default function ZakatCalculator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [mode, setMode] = useState<'maal' | 'income'>('maal');
  const [goldPrice, setGoldPrice] = useState('1300000');
  const [assets, setAssets] = useState('');
  const [liabilities, setLiabilities] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');

  const nisab = goldNisab(Number(goldPrice) || 0);
  const m = (v: number) => formatMoney(Math.round(v), 'IDR');
  const input = 'w-full border-2 border-border bg-muted p-2 text-sm tabular-nums';

  const maal = zakatMaal(Number(assets) || 0, Number(liabilities) || 0, nisab);
  const income = zakatIncome(Number(monthlyIncome) || 0, nisab);
  const due = mode === 'maal' ? maal.due : income.due;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.goldPrice}</span>
          <input value={goldPrice} onChange={e => setGoldPrice(e.target.value)} inputMode="numeric" className={input} /></label>
        <div className="space-y-1 text-sm"><span className="block font-semibold">{t.nisab}</span>
          <div className="border-2 border-border bg-background p-2 text-sm font-bold tabular-nums">{m(nisab)}</div></div>
      </div>

      <div className="flex gap-1">
        {(['maal', 'income'] as const).map(md => (
          <button key={md} onClick={() => setMode(md)} aria-pressed={mode === md}
            className={`border-2 px-3 py-1 text-sm font-medium transition-all ${mode === md ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'}`}>
            {md === 'maal' ? t.maal : t.income}
          </button>
        ))}
      </div>

      {mode === 'maal' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2"><span className="block font-semibold">{t.assets}</span>
            <input value={assets} onChange={e => setAssets(e.target.value)} inputMode="numeric" className={input} /></label>
          <label className="space-y-1 text-sm sm:col-span-2"><span className="block font-semibold">{t.liabilities}</span>
            <input value={liabilities} onChange={e => setLiabilities(e.target.value)} inputMode="numeric" className={input} /></label>
          <div className="space-y-1 text-sm sm:col-span-2"><span className="block font-semibold">{t.net}</span>
            <div className="border-2 border-border bg-background p-2 font-bold tabular-nums">{m(maal.net)}</div></div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.monthlyIncome}</span>
            <input value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)} inputMode="numeric" className={input} /></label>
          <div className="space-y-1 text-sm"><span className="block font-semibold">{t.annual}</span>
            <div className="border-2 border-border bg-background p-2 font-bold tabular-nums">{m(income.annual)}</div></div>
        </div>
      )}

      {due ? (
        <div className="border-2 border-border bg-lime-100 p-4 text-black shadow-brutal dark:bg-lime-900/40 dark:text-white">
          {mode === 'maal' ? (
            <>
              <div className="text-xs font-bold uppercase tracking-wide">{t.zakat}</div>
              <div className="text-3xl font-black tabular-nums">{m(maal.amount)}</div>
            </>
          ) : (
            <div className="flex flex-wrap gap-6">
              <div><div className="text-xs font-bold uppercase tracking-wide">{t.perMonth}</div><div className="text-2xl font-black tabular-nums">{m(income.monthlyZakat)}</div></div>
              <div><div className="text-xs font-bold uppercase tracking-wide">{t.perYear}</div><div className="text-2xl font-black tabular-nums">{m(income.annualZakat)}</div></div>
            </div>
          )}
        </div>
      ) : (
        <div className="border-2 border-border bg-yellow-300 p-3 text-sm font-medium text-black shadow-brutal-sm">{t.notDue}</div>
      )}
    </div>
  );
}
