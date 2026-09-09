import { useEffect, useRef, useState } from 'react';
import { Locate } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { useTabTitle } from '@/hooks/useTabTitle';
import { clockReadout, detectTimeZone, listTimeZones, type ClockReadout } from '@/tools/calculators/clock.lib';
import type { Lang } from '@/i18n/config';

const LOCALE: Record<Lang, string> = { en: 'en-US', id: 'id-ID' };

const TR: Record<Lang, {
  intro: string; timezone: string; useMine: string; format: string;
  date: string; unix: string; seconds: string; millis: string; copyMs: string; copyIso: string;
  precision: string;
}> = {
  en: {
    intro: 'The current time, ticking live in real time — with milliseconds and microseconds — for any time zone. Runs entirely in your browser using your device clock.',
    timezone: 'Time zone', useMine: 'My zone', format: 'Format',
    date: 'Date', unix: 'Unix time', seconds: 's', millis: 'ms', copyMs: 'Copy ms', copyIso: 'Copy ISO',
    precision: 'Milliseconds and microseconds are read from the browser high-resolution timer. Browsers clamp this timer for security, so the smallest digits are best-effort, not a true hardware microsecond clock.',
  },
  id: {
    intro: 'Waktu saat ini, berdetak langsung secara real-time — dengan milidetik dan mikrodetik — untuk zona waktu apa pun. Berjalan sepenuhnya di browser Anda memakai jam perangkat.',
    timezone: 'Zona waktu', useMine: 'Zona saya', format: 'Format',
    date: 'Tanggal', unix: 'Waktu Unix', seconds: 'd', millis: 'md', copyMs: 'Salin ms', copyIso: 'Salin ISO',
    precision: 'Milidetik dan mikrodetik dibaca dari high-resolution timer browser. Browser membatasi timer ini demi keamanan, jadi digit terkecil bersifat best-effort, bukan jam mikrodetik perangkat keras sebenarnya.',
  },
};

export default function Clock({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const locale = LOCALE[lang] ?? LOCALE.en;

  const [tz, setTz] = useState(() => detectTimeZone());
  const [hour12, setHour12] = useState(false);
  const [ro, setRo] = useState<ClockReadout>(() => clockReadout(Date.now(), detectTimeZone(), false, locale));
  const zones = useRef<string[]>(listTimeZones());

  useEffect(() => {
    // A single high-resolution clock: anchor the wall-clock epoch to the
    // monotonic timer once, then advance it every animation frame.
    const base = Date.now() - performance.now();
    let raf = 0;
    const loop = () => {
      setRo(clockReadout(base + performance.now(), tz, hour12, locale));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tz, hour12, locale]);

  // Mirror HH:MM:SS in the tab title (updates once per second — the string only
  // changes when the second does) so the time is visible from another tab.
  useTabTitle(`🕐 ${ro.hh}:${ro.mm}:${ro.ss}`);

  const iso = new Date(ro.epochMs).toISOString();

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="border-2 border-border p-6 text-center shadow-brutal">
        <div className="font-mono font-black tabular-nums leading-none">
          <span className="text-6xl sm:text-7xl">{ro.hh}:{ro.mm}:{ro.ss}</span>
          <span className="text-3xl text-accent sm:text-4xl">.{ro.millis}</span>
          <span className="text-2xl text-muted-foreground sm:text-3xl"> {ro.micros}</span>
          {ro.dayPeriod && <span className="ml-2 text-2xl sm:text-3xl">{ro.dayPeriod}</span>}
        </div>
        <div className="mt-3 text-sm font-semibold">{ro.dateLabel}</div>
        <div className="text-xs text-muted-foreground">{tz.replace('_', ' ')} · {ro.offsetLabel}</div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.timezone}</span>
          <div className="flex gap-2">
            <select
              aria-label={t.timezone}
              value={tz}
              onChange={e => setTz(e.target.value)}
              className="h-10 max-w-[16rem] border-2 border-border bg-muted px-2 text-sm outline-none focus:shadow-brutal-sm"
            >
              {zones.current.map(z => (
                <option key={z} value={z}>{z.replace('_', ' ')}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setTz(detectTimeZone())}
              className="inline-flex h-10 items-center gap-1 border-2 border-border px-3 text-xs font-bold uppercase tracking-wide hover:bg-muted"
            >
              <Locate className="h-4 w-4" aria-hidden />{t.useMine}
            </button>
          </div>
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.format}</span>
          <div className="flex overflow-hidden border-2 border-border">
            {([['24h', false], ['12h', true]] as const).map(([lbl, is12]) => (
              <button
                key={lbl}
                type="button"
                aria-pressed={hour12 === is12}
                onClick={() => setHour12(is12)}
                className={`h-10 px-4 text-sm font-bold ${hour12 === is12 ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm">
        <span className="font-mono tabular-nums">
          {t.unix}: <strong>{ro.epochSec}</strong>{t.seconds} · <strong>{ro.epochMs}</strong>{t.millis}
        </span>
        <CopyButton value={String(ro.epochMs)} label={t.copyMs} />
        <CopyButton value={iso} label={t.copyIso} />
      </div>

      <p className="text-xs text-muted-foreground">{t.precision}</p>
    </div>
  );
}
