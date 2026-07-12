import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { describeDate, parseTimestamp, type Parsed } from '@/tools/dev/timestamp.lib';

export default function Timestamp() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Parsed | null>(null);
  const [error, setError] = useState('');

  const parse = () => {
    setError('');
    setResult(null);
    const trimmed = input.trim();
    if (!trimmed) return;

    const date = parseTimestamp(trimmed);
    if (date === null) {
      setError('Could not parse that as a date or Unix timestamp.');
      return;
    }
    setResult(describeDate(date));
  };

  const now = () => setResult(describeDate(new Date()));

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
