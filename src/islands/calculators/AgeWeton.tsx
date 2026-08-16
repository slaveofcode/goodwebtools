import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { parseISODate, ageParts, ageTotals, nextBirthday } from '@/tools/calculators/age.lib';
import { weton as computeWeton } from '@/tools/calculators/weton.lib';
import type { Lang } from '@/i18n/config';

/** Local calendar date as YYYY-MM-DD (for the default "as of today"). */
function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const WEEKDAYS: Record<Lang, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  id: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
};

const TR: Record<Lang, {
  intro: string; birth: string; asOf: string; future: string;
  ageHeading: string; years: string; months: string; days: string;
  bornOn: string; totalsHeading: string; totalMonths: string; totalWeeks: string;
  totalDays: string; totalHours: string; nextBday: string; inDays: string; turning: string; today: string;
  wetonHeading: string; wetonHint: string; neptu: string; weekdayN: string; pasaranN: string; total: string;
}> = {
  en: {
    intro: 'Work out an exact age — years, months and days — plus total months, weeks, days and hours, the weekday you were born, and your next birthday. It also shows your Javanese weton (weekday + pasaran) and neptu. Everything is calculated in your browser.',
    birth: 'Date of birth',
    asOf: 'Age at date',
    future: 'The date of birth is after the “age at” date. Pick an earlier birth date.',
    ageHeading: 'Age',
    years: 'years', months: 'months', days: 'days',
    bornOn: 'Born on a',
    totalsHeading: 'In total',
    totalMonths: 'months', totalWeeks: 'weeks', totalDays: 'days', totalHours: 'hours',
    nextBday: 'Next birthday',
    inDays: 'in {n} days', turning: 'turning {n}', today: 'today 🎉',
    wetonHeading: 'Javanese weton',
    wetonHint: 'The pairing of the 7-day week with the 5-day pasaran cycle used in Javanese tradition.',
    neptu: 'Neptu', weekdayN: 'weekday', pasaranN: 'pasaran', total: 'total',
  },
  id: {
    intro: 'Hitung usia persis — tahun, bulan, dan hari — plus total bulan, minggu, hari, dan jam, hari kelahiran Anda, serta ulang tahun berikutnya. Menampilkan juga weton (hari + pasaran) dan neptu Jawa Anda. Semua dihitung di browser Anda.',
    birth: 'Tanggal lahir',
    asOf: 'Usia pada tanggal',
    future: 'Tanggal lahir setelah tanggal “usia pada”. Pilih tanggal lahir yang lebih awal.',
    ageHeading: 'Usia',
    years: 'tahun', months: 'bulan', days: 'hari',
    bornOn: 'Lahir pada hari',
    totalsHeading: 'Total',
    totalMonths: 'bulan', totalWeeks: 'minggu', totalDays: 'hari', totalHours: 'jam',
    nextBday: 'Ulang tahun berikutnya',
    inDays: '{n} hari lagi', turning: 'menjadi {n}', today: 'hari ini 🎉',
    wetonHeading: 'Weton Jawa',
    wetonHint: 'Perpaduan siklus 7 hari dengan siklus pasaran 5 hari dalam tradisi Jawa.',
    neptu: 'Neptu', weekdayN: 'hari', pasaranN: 'pasaran', total: 'total',
  },
};

export default function AgeWeton({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const wd = WEEKDAYS[lang] ?? WEEKDAYS.en;
  const [birth, setBirth] = useState('');
  const [asOf, setAsOf] = useState(todayISO());

  const nf = useMemo(() => new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US'), [lang]);

  const result = useMemo(() => {
    const b = parseISODate(birth);
    const a = parseISODate(asOf);
    if (!b || !a) return null;
    if (b.getTime() > a.getTime()) return { error: true as const };
    return {
      error: false as const,
      parts: ageParts(b, a),
      totals: ageTotals(b, a),
      next: nextBirthday(b, a),
      wet: computeWeton(b),
      bornWeekday: b.getUTCDay(),
    };
  }, [birth, asOf]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.birth}</span>
          <input type="date" value={birth} max={asOf} onChange={e => setBirth(e.target.value)}
            className="w-full border-2 border-border bg-muted p-2 text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.asOf}</span>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="w-full border-2 border-border bg-muted p-2 text-sm" />
        </label>
      </div>

      {result?.error && <Alert variant="error">{t.future}</Alert>}

      {result && !result.error && (
        <div className="space-y-4">
          <div className="border-2 border-border bg-accent p-4 text-accent-foreground shadow-brutal">
            <span className="text-xs font-bold uppercase tracking-wide">{t.ageHeading}</span>
            <p className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
              {nf.format(result.parts.years)} {t.years}, {result.parts.months} {t.months}, {result.parts.days} {t.days}
            </p>
            <p className="mt-1 text-sm">{t.bornOn} <span className="font-bold">{wd[result.bornWeekday]}</span></p>
          </div>

          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.totalsHeading}</span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { v: result.totals.months, l: t.totalMonths },
                { v: result.totals.weeks, l: t.totalWeeks },
                { v: result.totals.days, l: t.totalDays },
                { v: result.totals.hours, l: t.totalHours },
              ].map(x => (
                <div key={x.l} className="border-2 border-border p-2 text-center">
                  <div className="text-lg font-black tabular-nums">{nf.format(x.v)}</div>
                  <div className="text-xs text-muted-foreground">{x.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 border-border p-3">
            <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.nextBday}</span>
            <p className="mt-1 text-sm">
              {result.next.inDays === 0
                ? <span className="font-bold">{t.today}</span>
                : <>
                    <span className="font-bold">{t.inDays.replace('{n}', nf.format(result.next.inDays))}</span>
                    {' · '}{t.turning.replace('{n}', String(result.next.turning))}
                  </>}
            </p>
          </div>

          <div className="border-2 border-border bg-lime-100 p-4 text-black dark:bg-lime-900/40 dark:text-white">
            <span className="text-xs font-bold uppercase tracking-wide">{t.wetonHeading}</span>
            <p className="mt-1 text-2xl font-black">{result.wet.label}</p>
            <p className="mt-1 text-xs opacity-80">{t.wetonHint}</p>
            <div className="mt-2 text-sm">
              <span className="font-semibold">{t.neptu}:</span>{' '}
              {t.weekdayN} {result.wet.neptu.weekday} + {t.pasaranN} {result.wet.neptu.pasaran} ={' '}
              <span className="font-bold">{result.wet.neptu.total}</span> {t.total}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
