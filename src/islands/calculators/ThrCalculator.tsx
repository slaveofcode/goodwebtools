import { useState } from 'react';
import { formatMoney } from '@/tools/dev/invoice.lib';
import { calcThr } from '@/tools/calculators/thr.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Estimate an employee’s THR (Tunjangan Hari Raya) under Indonesian rules: one month’s pay at 12+ months of service, prorated below that. Runs in your browser.',
    salary: 'Monthly salary (base + fixed allowances)', months: 'Months worked',
    thr: 'THR', full: 'Full — one month’s salary', proportional: 'Proportional (months ÷ 12 × salary)',
    notEntitled: 'Under 1 month of service — no THR entitlement under the regulation.',
  },
  id: {
    intro: 'Perkirakan THR (Tunjangan Hari Raya) karyawan sesuai aturan Indonesia: satu bulan upah bila masa kerja 12+ bulan, proporsional di bawah itu. Berjalan di browser Anda.',
    salary: 'Upah sebulan (pokok + tunjangan tetap)', months: 'Masa kerja (bulan)',
    thr: 'THR', full: 'Penuh — satu bulan upah', proportional: 'Proporsional (bulan ÷ 12 × upah)',
    notEntitled: 'Masa kerja kurang dari 1 bulan — belum berhak THR menurut peraturan.',
  },
};

export default function ThrCalculator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [salary, setSalary] = useState('5000000');
  const [months, setMonths] = useState('12');

  const r = calcThr(Number(salary) || 0, Number(months) || 0);
  const m = (v: number) => formatMoney(Math.round(v), 'IDR');
  const input = 'w-full border-2 border-border bg-muted p-2 text-sm tabular-nums';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.salary}</span>
          <input value={salary} onChange={e => setSalary(e.target.value)} inputMode="numeric" className={input} /></label>
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.months}</span>
          <input value={months} onChange={e => setMonths(e.target.value)} inputMode="decimal" className={input} /></label>
      </div>

      {r.entitled ? (
        <div className="border-2 border-border bg-lime-100 p-4 text-black shadow-brutal dark:bg-lime-900/40 dark:text-white">
          <div className="text-xs font-bold uppercase tracking-wide">{t.thr}</div>
          <div className="text-3xl font-black tabular-nums sm:text-4xl">{m(r.amount)}</div>
          <div className="mt-1 text-xs opacity-80">{r.proportional ? t.proportional : t.full}</div>
        </div>
      ) : (
        <div className="border-2 border-border bg-yellow-300 p-3 text-sm font-medium text-black shadow-brutal-sm">{t.notEntitled}</div>
      )}
    </div>
  );
}
