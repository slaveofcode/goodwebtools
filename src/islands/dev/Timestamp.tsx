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
} from '@/tools/dev/timestamp.lib';

const TIME_ZONES = listTimeZones();

export default function Timestamp() {
  const [input, setInput] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [timeZone, setTimeZone] = useState(() => getLocalTimeZone());
  const [error, setError] = useState('');

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

      <div className="flex flex-wrap gap-2">
        <Button onClick={convert}>Convert</Button>
        <Button variant="secondary" onClick={now}>
          Now
        </Button>
        <Button variant="ghost" onClick={() => { setInput(''); setDate(null); setError(''); }}>
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
