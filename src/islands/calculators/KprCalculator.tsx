import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { loanSummary, buildSchedule } from '@/tools/calculators/kpr.lib';
import { formatMoney } from '@/tools/dev/invoice.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Work out your monthly home-loan (KPR) installment. Enter the property price, down payment, fixed interest rate and tenor to see the monthly payment, total interest and full amortisation schedule. Runs in your browser.',
    price: 'Property price', dp: 'Down payment %', dpAmount: 'Down payment', loan: 'Loan amount',
    rate: 'Interest rate % / year', tenor: 'Tenor (years)',
    monthly: 'Monthly installment', totalInterest: 'Total interest', totalPayment: 'Total payment',
    showSchedule: 'Show amortisation schedule', hideSchedule: 'Hide schedule',
    month: 'Month', interestCol: 'Interest', principalCol: 'Principal', balance: 'Balance',
  },
  id: {
    intro: 'Hitung cicilan KPR bulanan Anda. Masukkan harga properti, uang muka, suku bunga tetap, dan tenor untuk melihat cicilan bulanan, total bunga, dan tabel amortisasi lengkap. Berjalan di browser Anda.',
    price: 'Harga properti', dp: 'Uang muka %', dpAmount: 'Uang muka', loan: 'Jumlah pinjaman',
    rate: 'Suku bunga % / tahun', tenor: 'Tenor (tahun)',
    monthly: 'Cicilan per bulan', totalInterest: 'Total bunga', totalPayment: 'Total pembayaran',
    showSchedule: 'Tampilkan tabel angsuran', hideSchedule: 'Sembunyikan tabel',
    month: 'Bulan', interestCol: 'Bunga', principalCol: 'Pokok', balance: 'Sisa',
  },
};

export default function KprCalculator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [price, setPrice] = useState('500000000');
  const [dpPercent, setDpPercent] = useState('20');
  const [ratePercent, setRatePercent] = useState('9');
  const [years, setYears] = useState('15');
  const [showSchedule, setShowSchedule] = useState(false);

  const p = Number(price) || 0;
  const dpPct = Number(dpPercent) || 0;
  const dpAmount = p * (dpPct / 100);
  const loan = Math.max(0, p - dpAmount);
  const months = (Number(years) || 0) * 12;
  const rate = Number(ratePercent) || 0;

  const summary = useMemo(() => loanSummary(loan, rate, months), [loan, rate, months]);
  const schedule = useMemo(() => (showSchedule ? buildSchedule(loan, rate, months) : []), [showSchedule, loan, rate, months]);
  const m = (v: number) => formatMoney(Math.round(v), 'IDR');

  const input = 'w-full border-2 border-border bg-muted p-2 text-sm tabular-nums';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.price}</span>
          <input value={price} onChange={e => setPrice(e.target.value)} inputMode="numeric" className={input} /></label>
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.dp}</span>
          <input value={dpPercent} onChange={e => setDpPercent(e.target.value)} inputMode="decimal" className={input} />
          <span className="text-xs text-muted-foreground">{t.dpAmount}: {m(dpAmount)}</span></label>
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.rate}</span>
          <input value={ratePercent} onChange={e => setRatePercent(e.target.value)} inputMode="decimal" className={input} /></label>
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.tenor}</span>
          <input value={years} onChange={e => setYears(e.target.value)} inputMode="numeric" className={input} /></label>
      </div>

      <div className="border-2 border-border bg-lime-100 p-4 text-black shadow-brutal dark:bg-lime-900/40 dark:text-white">
        <div className="text-xs font-bold uppercase tracking-wide">{t.monthly}</div>
        <div className="text-3xl font-black tabular-nums sm:text-4xl">{m(summary.monthly)}</div>
        <div className="mt-1 text-xs opacity-80">{t.loan}: {m(loan)}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="border-2 border-border p-3 text-center">
          <div className="text-lg font-black tabular-nums">{m(summary.totalInterest)}</div>
          <div className="text-xs text-muted-foreground">{t.totalInterest}</div>
        </div>
        <div className="border-2 border-border p-3 text-center">
          <div className="text-lg font-black tabular-nums">{m(summary.totalPayment)}</div>
          <div className="text-xs text-muted-foreground">{t.totalPayment}</div>
        </div>
      </div>

      {months > 0 && loan > 0 && (
        <Button variant="secondary" onClick={() => setShowSchedule(s => !s)}>
          {showSchedule ? t.hideSchedule : t.showSchedule}
        </Button>
      )}

      {showSchedule && schedule.length > 0 && (
        <div className="max-h-96 overflow-auto border-2 border-border">
          <table className="w-full text-right text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="p-2 text-left">{t.month}</th>
                <th className="p-2">{t.interestCol}</th>
                <th className="p-2">{t.principalCol}</th>
                <th className="p-2">{t.balance}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map(r => (
                <tr key={r.month} className="border-t border-border">
                  <td className="p-2 text-left">{r.month}</td>
                  <td className="p-2">{m(r.interest)}</td>
                  <td className="p-2">{m(r.principal)}</td>
                  <td className="p-2">{m(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
