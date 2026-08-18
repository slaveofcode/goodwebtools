import { useEffect, useState } from 'react';
import { breakdown, daysUntil, businessDaysUntil } from '@/tools/calculators/countdown.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; label: string; days: string; hours: string; minutes: string; seconds: string;
  until: string; ago: string; calDays: string; bizDays: string; pick: string; past: string;
}> = {
  en: {
    intro: 'Count down to any date and time — a deadline, birthday, launch or holiday — and see exactly how many days, hours, minutes and seconds are left. Runs in your browser.',
    label: 'Target date & time', days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds',
    until: 'until', ago: 'ago', calDays: 'Calendar days', bizDays: 'Business days (Mon–Fri)', pick: 'Pick a date and time to start the countdown.', past: 'That moment has passed.',
  },
  id: {
    intro: 'Hitung mundur ke tanggal dan waktu apa pun — tenggat, ulang tahun, peluncuran, atau liburan — dan lihat persis berapa hari, jam, menit, dan detik tersisa. Berjalan di browser Anda.',
    label: 'Tanggal & waktu target', days: 'Hari', hours: 'Jam', minutes: 'Menit', seconds: 'Detik',
    until: 'lagi', ago: 'lalu', calDays: 'Hari kalender', bizDays: 'Hari kerja (Sen–Jum)', pick: 'Pilih tanggal dan waktu untuk memulai hitung mundur.', past: 'Momen itu sudah lewat.',
  },
};

function Cell({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-muted/40 px-2 py-3">
      <span className="text-3xl font-bold tabular-nums sm:text-4xl">{n}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Countdown({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [target, setTarget] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const targetMs = target ? new Date(target).getTime() : NaN;
  const valid = Number.isFinite(targetMs);
  const b = valid ? breakdown(now, targetMs) : null;
  const cal = valid ? daysUntil(new Date(now), new Date(targetMs)) : 0;
  const biz = valid ? businessDaysUntil(new Date(now), new Date(targetMs)) : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t.label}</span>
        <input
          type="datetime-local"
          value={target}
          onChange={e => setTarget(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      {!valid ? (
        <p className="text-sm text-muted-foreground">{t.pick}</p>
      ) : (
        <div className="space-y-3">
          {b?.past && <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{t.past}</p>}
          <div className="grid grid-cols-4 gap-2">
            <Cell n={b!.days} label={t.days} />
            <Cell n={b!.hours} label={t.hours} />
            <Cell n={b!.minutes} label={t.minutes} />
            <Cell n={b!.seconds} label={t.seconds} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>{t.calDays}: <strong>{Math.abs(cal)}</strong> {b?.past ? t.ago : t.until}</span>
            <span>{t.bizDays}: <strong>{Math.abs(biz)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
