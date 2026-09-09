import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  parseLocalValue,
  toLocalValue,
  sameDay,
  buildMonthGrid,
  to12h,
  from12h,
  presetDate,
  type PresetKind,
} from '@/tools/calculators/datetime-picker.lib';
import type { Lang } from '@/i18n/config';

interface Props {
  /** `YYYY-MM-DDTHH:mm` local value, or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  lang?: Lang;
  /** Placeholder shown on the field when no value is set. */
  placeholder?: string;
  id?: string;
}

const LOCALE: Record<Lang, string> = { en: 'en-US', id: 'id-ID' };

const PRESETS: PresetKind[] = ['tomorrow', 'nextWeek', 'newYear'];
const PRESET_LABELS: Record<Lang, Record<PresetKind, string>> = {
  en: { tomorrow: 'Tomorrow', nextWeek: 'In 1 week', newYear: "New Year's Day" },
  id: { tomorrow: 'Besok', nextWeek: 'Dalam 1 minggu', newYear: 'Tahun Baru' },
};
const TR: Record<Lang, { clear: string; done: string; time: string; placeholder: string }> = {
  en: { clear: 'Clear', done: 'Done', time: 'Time', placeholder: 'Pick a date & time' },
  id: { clear: 'Hapus', done: 'Selesai', time: 'Waktu', placeholder: 'Pilih tanggal & waktu' },
};

export function DateTimePicker({ value, onChange, lang = 'en', placeholder, id }: Props) {
  const locale = LOCALE[lang] ?? LOCALE.en;
  const t = TR[lang] ?? TR.en;
  const presetLabels = PRESET_LABELS[lang] ?? PRESET_LABELS.en;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => parseLocalValue(value), [value]);
  const [view, setView] = useState(() => {
    const d = parseLocalValue(value) ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Keep the visible month in sync when the value is set from the outside (e.g. a preset).
  useEffect(() => {
    if (selected) setView({ year: selected.getFullYear(), month: selected.getMonth() });
  }, [selected]);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  }, [locale]);

  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view]);
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(view.year, view.month, 1)),
    [locale, view],
  );

  const displayLabel = selected
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(selected)
    : (placeholder ?? t.placeholder);

  const hour24 = selected?.getHours() ?? 0;
  const minute = selected?.getMinutes() ?? 0;
  const { hour12, ampm } = to12h(hour24);

  // Base date used when only the time changes (or falls back to today).
  const baseDate = selected ?? new Date(new Date().setHours(0, 0, 0, 0));

  function emit(d: Date) {
    onChange(toLocalValue(d));
  }

  function pickDay(day: Date) {
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour24, minute);
    emit(d);
  }

  function setHour12(h12: number) {
    emit(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), from12h(h12, ampm), minute));
  }
  function setMinute(mi: number) {
    emit(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour24, mi));
  }
  function setAmpm(next: 'AM' | 'PM') {
    emit(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), from12h(hour12, next), minute));
  }
  function applyPreset(kind: PresetKind) {
    emit(presetDate(kind, new Date()));
  }
  function moveMonth(delta: number) {
    setView(v => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  const today = new Date();

  return (
    <div ref={wrapRef} className="relative w-full max-w-xs">
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-sm outline-none focus:border-accent"
      >
        <span className={selected ? '' : 'text-muted-foreground'}>{displayLabel}</span>
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.placeholder}
          className="absolute left-0 z-20 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-lg border-2 border-border bg-background p-3 shadow-brutal"
        >
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => applyPreset(k)}
                className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium hover:border-accent"
              >
                {presetLabels[k]}
              </button>
            ))}
          </div>

          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
              className="rounded-md border border-border p-1 hover:border-accent"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-sm font-semibold">{monthLabel}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              className="rounded-md border border-border p-1 hover:border-accent"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[0.65rem] uppercase text-muted-foreground">
            {weekdays.map((w, i) => (
              <span key={i} className="py-1">{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c, i) => {
              const isSel = selected != null && sameDay(c.date, selected);
              const isToday = sameDay(c.date, today);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(c.date)}
                  aria-label={c.date.toDateString()}
                  aria-pressed={isSel}
                  className={[
                    'flex h-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors',
                    c.inMonth ? '' : 'text-muted-foreground/40',
                    isSel
                      ? 'bg-accent font-bold text-accent-foreground'
                      : isToday
                        ? 'border border-accent'
                        : 'hover:bg-muted',
                  ].join(' ')}
                >
                  {c.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">{t.time}</span>
            <select
              aria-label="Hour"
              value={hour12}
              onChange={e => setHour12(Number(e.target.value))}
              className="rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-accent"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
              ))}
            </select>
            <span aria-hidden>:</span>
            <select
              aria-label="Minute"
              value={minute}
              onChange={e => setMinute(Number(e.target.value))}
              className="rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-accent"
            >
              {Array.from({ length: 60 }, (_, i) => i).map(mi => (
                <option key={mi} value={mi}>{String(mi).padStart(2, '0')}</option>
              ))}
            </select>
            <div className="ml-1 flex overflow-hidden rounded-md border border-border">
              {(['AM', 'PM'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmpm(p)}
                  className={`px-2 py-1 text-xs font-semibold ${ampm === p ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex justify-between">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t.clear}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border-2 border-border bg-accent px-3 py-1 text-xs font-bold uppercase text-accent-foreground shadow-brutal press-brutal"
            >
              {t.done}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateTimePicker;
