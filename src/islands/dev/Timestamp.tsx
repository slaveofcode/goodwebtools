import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';

interface Parsed {
  unixSeconds: number;
  unixMillis: number;
  iso: string;
  utc: string;
  local: string;
}

function describe(date: Date): Parsed {
  return {
    unixSeconds: Math.floor(date.getTime() / 1000),
    unixMillis: date.getTime(),
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toString(),
  };
}

export default function Timestamp() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Parsed | null>(null);
  const [error, setError] = useState('');

  const parse = () => {
    setError('');
    setResult(null);
    const trimmed = input.trim();
    if (!trimmed) return;

    let date: Date;
    if (/^\d+$/.test(trimmed)) {
      // Numeric: treat 10-digit as seconds, 13-digit as milliseconds.
      const num = Number(trimmed);
      date = new Date(trimmed.length <= 10 ? num * 1000 : num);
    } else {
      date = new Date(trimmed);
    }

    if (Number.isNaN(date.getTime())) {
      setError('Could not parse that as a date or Unix timestamp.');
      return;
    }
    setResult(describe(date));
  };

  const now = () => setResult(describe(new Date()));

  const rows: [string, string][] = result
    ? [
        ['Unix (seconds)', String(result.unixSeconds)],
        ['Unix (millis)', String(result.unixMillis)],
        ['ISO 8601', result.iso],
        ['UTC', result.utc],
        ['Local', result.local],
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
        <Button onClick={parse}>Convert</Button>
        <Button variant="secondary" onClick={now}>Now</Button>
        <Button variant="ghost" onClick={() => { setInput(''); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {rows.map(([label, val]) => (
            <div key={label} className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className="flex items-center gap-2">
                <code className="text-sm">{val}</code>
                <CopyButton value={val} label="" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
