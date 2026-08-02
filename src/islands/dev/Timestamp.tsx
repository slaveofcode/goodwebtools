import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import type { Lang } from '@/i18n/config';
import {
  describeDate,
  parseTimestamp,
  detectNumericUnit,
  formatInTimeZone,
  listTimeZones,
  getLocalTimeZone,
  parseDateTimeLocal,
} from '@/tools/dev/timestamp.lib';

const TIME_ZONES = listTimeZones();

const TR: Record<Lang, {
  inputLabel: string;
  convert: string;
  now: string;
  orPick: string;
  local: string;
  utc: string;
  clear: string;
  parseError: string;
  detectedPrefix: string;
  convertToTz: string;
  rowUnixSeconds: string;
  rowUnixMillis: string;
  rowIso: string;
  rowUtc: string;
  rowLocal: string;
  rowIn: (tz: string) => string;
}> = {
  en: {
    inputLabel: 'Unix timestamp or date string',
    convert: 'Convert',
    now: 'Now',
    orPick: 'Or pick date & time',
    local: 'Local',
    utc: 'UTC',
    clear: 'Clear',
    parseError: 'Could not parse that as a date or Unix timestamp.',
    detectedPrefix: 'Detected numeric input as',
    convertToTz: 'Convert to time zone',
    rowUnixSeconds: 'Unix (seconds)',
    rowUnixMillis: 'Unix (millis)',
    rowIso: 'ISO 8601',
    rowUtc: 'UTC',
    rowLocal: 'Local',
    rowIn: (tz) => `In ${tz}`,
  },
  id: {
    inputLabel: 'Timestamp Unix atau string tanggal',
    convert: 'Konversi',
    now: 'Sekarang',
    orPick: 'Atau pilih tanggal & waktu',
    local: 'Lokal',
    utc: 'UTC',
    clear: 'Bersihkan',
    parseError: 'Tidak dapat mengurai itu sebagai tanggal atau timestamp Unix.',
    detectedPrefix: 'Input numerik terdeteksi sebagai',
    convertToTz: 'Konversi ke zona waktu',
    rowUnixSeconds: 'Unix (detik)',
    rowUnixMillis: 'Unix (milidetik)',
    rowIso: 'ISO 8601',
    rowUtc: 'UTC',
    rowLocal: 'Lokal',
    rowIn: (tz) => `Di ${tz}`,
  },
};

export default function Timestamp({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [input, setInput] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [timeZone, setTimeZone] = useState(() => getLocalTimeZone());
  const [error, setError] = useState('');
  const [detectedUnit, setDetectedUnit] = useState('');
  const [pickerValue, setPickerValue] = useState('');
  const [pickerZone, setPickerZone] = useState<'local' | 'utc'>('local');

  // Apply the date/time picker (interpreted as local or UTC) to the result.
  const applyPicker = (value: string, zone: 'local' | 'utc') => {
    setPickerValue(value);
    setPickerZone(zone);
    setError('');
    setDetectedUnit('');
    if (!value) return;
    const parsed = parseDateTimeLocal(value, zone);
    if (parsed) setDate(parsed);
  };

  const convert = () => {
    setError('');
    setDate(null);
    setDetectedUnit('');
    const trimmed = input.trim();
    if (!trimmed) return;
    const parsed = parseTimestamp(trimmed);
    if (parsed === null) {
      setError(t.parseError);
      return;
    }
    setDate(parsed);
    // Surface how an all-digits value was interpreted (seconds/ms/µs/ns).
    if (/^\d+$/.test(trimmed)) setDetectedUnit(detectNumericUnit(trimmed));
  };

  const now = () => {
    setError('');
    setDetectedUnit('');
    setDate(new Date());
  };

  const described = date ? describeDate(date) : null;
  const rows: [string, string][] =
    date && described
      ? [
          [t.rowUnixSeconds, String(described.unixSeconds)],
          [t.rowUnixMillis, String(described.unixMillis)],
          [t.rowIso, described.iso],
          [t.rowUtc, described.utc],
          [t.rowLocal, described.local],
          [t.rowIn(timeZone), formatInTimeZone(date, timeZone)],
        ]
      : [];

  return (
    <div className="space-y-4">
      <TextArea
        label={t.inputLabel}
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="1720000000 (s · ms · µs · ns)  ·  2026-07-12  ·  Jul 12 2026 10:00"
        rows={2}
      />

      <div className="flex flex-wrap items-end gap-3">
        <Button onClick={convert}>{t.convert}</Button>
        <Button variant="secondary" onClick={now}>
          {t.now}
        </Button>

        {/* Pick a specific date & time, interpreted as local or UTC. */}
        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t.orPick}
          </span>
          <div className="flex flex-wrap items-stretch gap-2">
            <input
              type="datetime-local"
              step={1}
              value={pickerValue}
              onChange={e => applyPicker(e.target.value, pickerZone)}
              className="border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm dark:[color-scheme:dark]"
            />
            <div className="flex border-2 border-border">
              <button
                type="button"
                onClick={() => applyPicker(pickerValue, 'local')}
                aria-pressed={pickerZone === 'local'}
                className={`px-3 text-sm font-bold ${pickerZone === 'local' ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}
              >
                {t.local}
              </button>
              <button
                type="button"
                onClick={() => applyPicker(pickerValue, 'utc')}
                aria-pressed={pickerZone === 'utc'}
                className={`border-l-2 border-border px-3 text-sm font-bold ${pickerZone === 'utc' ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}
              >
                {t.utc}
              </button>
            </div>
          </div>
        </div>

        <Button variant="ghost" onClick={() => { setInput(''); setDate(null); setError(''); setDetectedUnit(''); setPickerValue(''); }}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {detectedUnit && (
        <p className="text-sm text-muted-foreground">
          {t.detectedPrefix}{' '}
          <span className="font-bold text-foreground">Unix {detectedUnit}</span>.
        </p>
      )}

      {date && (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">
              {t.convertToTz}
            </span>
            <select
              value={timeZone}
              onChange={e => setTimeZone(e.target.value)}
              className="border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
            >
              {TIME_ZONES.map(zone => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>

          <div className="divide-y-2 divide-border border-2 border-border">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 bg-muted px-3 py-2"
              >
                <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <code className="truncate text-sm">{value}</code>
                  <CopyButton value={value} label="" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
