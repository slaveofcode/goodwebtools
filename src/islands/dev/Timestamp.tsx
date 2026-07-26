import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import {
  describeDate,
  parseTimestamp,
  formatInTimeZone,
  listTimeZones,
  getLocalTimeZone,
  parseDateTimeLocal,
} from '@/tools/dev/timestamp.lib';

const TIME_ZONES = listTimeZones();

export default function Timestamp() {
  const [input, setInput] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [timeZone, setTimeZone] = useState(() => getLocalTimeZone());
  const [error, setError] = useState('');
  const [pickerValue, setPickerValue] = useState('');
  const [pickerZone, setPickerZone] = useState<'local' | 'utc'>('local');

  // Apply the date/time picker (interpreted as local or UTC) to the result.
  const applyPicker = (value: string, zone: 'local' | 'utc') => {
    setPickerValue(value);
    setPickerZone(zone);
    setError('');
    if (!value) return;
    const parsed = parseDateTimeLocal(value, zone);
    if (parsed) setDate(parsed);
  };

  const convert = () => {
    setError('');
    setDate(null);
    const trimmed = input.trim();
    if (!trimmed) return;
    const parsed = parseTimestamp(trimmed);
    if (parsed === null) {
      setError('Could not parse that as a date or Unix timestamp.');
      return;
    }
    setDate(parsed);
  };

  const now = () => {
    setError('');
    setDate(new Date());
  };

  const described = date ? describeDate(date) : null;
  const rows: [string, string][] =
    date && described
      ? [
          ['Unix (seconds)', String(described.unixSeconds)],
          ['Unix (millis)', String(described.unixMillis)],
          ['ISO 8601', described.iso],
          ['UTC', described.utc],
          ['Local', described.local],
          [`In ${timeZone}`, formatInTimeZone(date, timeZone)],
        ]
      : [];

  return (
    <div className="space-y-4">
      <TextArea
        label="Unix timestamp or date string"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="1720000000  ·  2026-07-12  ·  Jul 12 2026 10:00"
        rows={2}
      />

      <div className="flex flex-wrap items-end gap-3">
        <Button onClick={convert}>Convert</Button>
        <Button variant="secondary" onClick={now}>
          Now
        </Button>

        {/* Pick a specific date & time, interpreted as local or UTC. */}
        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Or pick date &amp; time
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
                Local
              </button>
              <button
                type="button"
                onClick={() => applyPicker(pickerValue, 'utc')}
                aria-pressed={pickerZone === 'utc'}
                className={`border-l-2 border-border px-3 text-sm font-bold ${pickerZone === 'utc' ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}
              >
                UTC
              </button>
            </div>
          </div>
        </div>

        <Button variant="ghost" onClick={() => { setInput(''); setDate(null); setError(''); setPickerValue(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {date && (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">
              Convert to time zone
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
