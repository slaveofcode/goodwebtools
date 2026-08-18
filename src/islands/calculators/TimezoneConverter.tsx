import { useEffect, useMemo, useState } from 'react';
import { COMMON_ZONES, offsetLabel, wallTimeToInstant, formatInZone } from '@/tools/calculators/timezone.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; sourceZone: string; sourceTime: string; yourZone: string; planner: string; hint: string }> = {
  en: {
    intro: 'Convert a time across time zones and plan meetings that span regions — pick a time in one place and see it everywhere at once, with daylight-saving handled automatically. Runs in your browser.',
    sourceZone: 'From time zone', sourceTime: 'Time (in that zone)', yourZone: 'your zone', planner: 'That time around the world',
    hint: 'Daylight-saving is applied automatically for the date you pick.',
  },
  id: {
    intro: 'Konversi waktu antar zona waktu dan rencanakan rapat lintas wilayah — pilih waktu di satu tempat dan lihat di semua tempat sekaligus, dengan daylight-saving otomatis. Berjalan di browser Anda.',
    sourceZone: 'Dari zona waktu', sourceTime: 'Waktu (di zona itu)', yourZone: 'zona Anda', planner: 'Waktu itu di seluruh dunia',
    hint: 'Daylight-saving diterapkan otomatis untuk tanggal yang Anda pilih.',
  },
};

function localZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

// Build a 'yyyy-MM-ddThh:mm' string for the current local time.
function nowLocalInput(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TimezoneConverter({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [zone, setZone] = useState('UTC');
  const [when, setWhen] = useState('');

  useEffect(() => { setZone(localZone()); setWhen(nowLocalInput()); }, []);

  // Ensure the detected local zone is selectable even if not in the common list.
  const zones = useMemo(() => {
    const list = [...COMMON_ZONES];
    if (!list.some(z => z.zone === zone)) list.unshift({ zone, label: `${zone} (${t.yourZone})` });
    return list;
  }, [zone, t.yourZone]);

  const instant = useMemo(() => {
    if (!when) return NaN;
    const m = when.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return NaN;
    return wallTimeToInstant(+m[1], +m[2], +m[3], +m[4], +m[5], zone);
  }, [when, zone]);

  const rows = useMemo(() => {
    if (!Number.isFinite(instant)) return [];
    return [...COMMON_ZONES]
      .map(z => ({ ...z, off: offsetLabel(instant, z.zone), time: formatInZone(instant, z.zone, lang) }))
      .sort((a, b) => (a.off < b.off ? -1 : a.off > b.off ? 1 : 0));
  }, [instant, lang]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t.sourceZone}</span>
          <select value={zone} onChange={e => setZone(e.target.value)}
            className="rounded-lg border border-border bg-muted/40 px-2 py-2 text-sm outline-none focus:border-accent">
            {zones.map(z => <option key={z.zone} value={z.zone}>{z.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t.sourceTime}</span>
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)}
            className="rounded-lg border border-border bg-muted/40 px-2 py-2 text-sm outline-none focus:border-accent" />
        </label>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t.planner}</p>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {rows.map(r => (
              <li key={r.zone} className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${r.zone === zone ? 'bg-accent/10' : 'bg-muted/40'}`}>
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono font-semibold">{r.time}</span>
                  <span className="w-16 text-right text-xs text-muted-foreground">{r.off}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
