import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}

function csvToJson(text: string): string {
  const rows = parseCsv(text);
  if (rows.length === 0) return '[]';
  const [header, ...body] = rows;
  const records = body.map(cells => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = cells[index] ?? '';
    });
    return record;
  });
  return JSON.stringify(records, null, 2);
}

function escapeCsvField(value: unknown): string {
  const str = value == null ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function jsonToCsv(text: string): string {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('JSON must be an array of objects');
  if (data.length === 0) return '';

  const headers = Array.from(
    data.reduce((set: Set<string>, item) => {
      Object.keys(item ?? {}).forEach(key => set.add(key));
      return set;
    }, new Set<string>())
  );

  const lines = [headers.map(escapeCsvField).join(',')];
  for (const item of data) {
    lines.push(headers.map(key => escapeCsvField(item?.[key])).join(','));
  }
  return lines.join('\n');
}

type Mode = 'toJson' | 'toCsv';

export default function CsvJson() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [activeMode, setActiveMode] = useState<Mode | null>(null);

  const run = (mode: Mode, source = input) => {
    setActiveMode(mode);
    setError('');
    if (!source.trim()) {
      setOutput('');
      return;
    }
    try {
      setOutput(mode === 'toJson' ? csvToJson(source) : jsonToCsv(source));
    } catch (e) {
      setOutput('');
      setError(e instanceof Error ? e.message : 'Conversion failed');
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (activeMode) run(activeMode, value);
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError('');
    setActiveMode(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeMode === 'toJson' ? 'primary' : 'secondary'}
          aria-pressed={activeMode === 'toJson'}
          onClick={() => run('toJson')}
        >
          CSV → JSON
        </Button>
        <Button
          variant={activeMode === 'toCsv' ? 'primary' : 'secondary'}
          aria-pressed={activeMode === 'toCsv'}
          onClick={() => run('toCsv')}
        >
          JSON → CSV
        </Button>
        <Button variant="ghost" onClick={clear}>
          Clear
        </Button>
      </div>

      <TextArea
        label="Input"
        value={input}
        onChange={e => handleInputChange(e.target.value)}
        placeholder={'name,age\nAlice,30\nBob,25'}
        rows={10}
      />

      {error && <Alert variant="error">{error}</Alert>}

      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Result</span>
            <CopyButton value={output} />
          </div>
          <pre className="max-h-[30rem] overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <code>{output}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
