import { useState } from 'react';
import { daysBetween, ymdBetween, addDays, businessDaysBetween } from '@/tools/calculators/datedur.lib';
import type { Lang } from '@/i18n/config';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Find the time between two dates — in years/months/days, total days, and working days — or add/subtract days from a date. All in your browser.',
    diff: 'Difference between dates', from: 'From', to: 'To',
    breakdown: 'Duration', totalDays: 'Total days', workDays: 'Working days (Mon–Fri)',
    y: 'years', mo: 'months', d: 'days',
    addSub: 'Add or subtract days', startDate: 'Start date', offset: 'Days (+/−)', resultDate: 'Result date',
  },
  id: {
    intro: 'Cari selisih antara dua tanggal — dalam tahun/bulan/hari, total hari, dan hari kerja — atau tambah/kurangi hari dari sebuah tanggal. Semua di browser Anda.',
    diff: 'Selisih antar tanggal', from: 'Dari', to: 'Sampai',
    breakdown: 'Durasi', totalDays: 'Total hari', workDays: 'Hari kerja (Sen–Jum)',
    y: 'tahun', mo: 'bulan', d: 'hari',
    addSub: 'Tambah atau kurangi hari', startDate: 'Tanggal mulai', offset: 'Hari (+/−)', resultDate: 'Tanggal hasil',
  },
};

export default function DateDuration({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(addDays(todayIso(), 30));
  const [start, setStart] = useState(todayIso());
  const [offset, setOffset] = useState('90');

  const total = daysBetween(from, to);
  const ymd = ymdBetween(from, to);
  const work = businessDaysBetween(from, to);
  const resultDate = addDays(start, Number(offset) || 0);
  const input = 'w-full border-2 border-border bg-muted p-2 text-sm tabular-nums';
  const valid = !Number.isNaN(total);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.diff}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.from}</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={input} /></label>
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.to}</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={input} /></label>
        </div>
        {valid && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border-2 border-border bg-lime-200 p-4 text-black shadow-brutal dark:bg-lime-900/40 dark:text-white">
              <div className="text-xs font-bold uppercase tracking-wide">{t.breakdown}</div>
              <div className="text-2xl font-black tabular-nums">{ymd.years}y {ymd.months}m {ymd.days}d</div>
              <div className="text-xs opacity-80">{ymd.years} {t.y}, {ymd.months} {t.mo}, {ymd.days} {t.d}</div>
            </div>
            <div className="border-2 border-border bg-muted p-4 shadow-brutal">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.totalDays}</div>
              <div className="text-2xl font-black tabular-nums">{Math.abs(total).toLocaleString()}</div>
            </div>
            <div className="border-2 border-border bg-muted p-4 shadow-brutal">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.workDays}</div>
              <div className="text-2xl font-black tabular-nums">{work.toLocaleString()}</div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3 border-t-2 border-border pt-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.addSub}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.startDate}</span>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className={input} /></label>
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.offset}</span>
            <input value={offset} onChange={e => setOffset(e.target.value)} inputMode="numeric" className={input} /></label>
          <div className="space-y-1 text-sm">
            <span className="block font-semibold">{t.resultDate}</span>
            <div className="border-2 border-border bg-lime-200 p-2 font-mono text-lg font-black tabular-nums text-black shadow-brutal-sm dark:bg-lime-900/40 dark:text-white">{resultDate}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
