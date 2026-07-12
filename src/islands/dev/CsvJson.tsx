import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { LoadFileButton, fileExt } from '@/components/ui/LoadFileButton';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { csvToJson, jsonToCsv, parseCsv } from '@/tools/dev/csv.lib';

const PREVIEW_ROWS = 100;

type Mode = 'toJson' | 'toCsv';

const DELIMITERS: { label: string; value: string }[] = [
  { label: 'Comma ,', value: ',' },
  { label: 'Semicolon ;', value: ';' },
  { label: 'Tab ⇥', value: '\t' },
  { label: 'Pipe |', value: '|' },
];

export default function CsvJson() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [activeMode, setActiveMode] = useState<Mode | null>(null);
  const [delimiter, setDelimiter] = useState(',');

  const run = (mode: Mode, source = input, delim = delimiter) => {
    setActiveMode(mode);
    setError('');
    if (!source.trim()) {
      setOutput('');
      return;
    }
    try {
      setOutput(mode === 'toJson' ? csvToJson(source, delim) : jsonToCsv(source, delim));
    } catch (e) {
      setOutput('');
      setError(e instanceof Error ? e.message : 'Conversion failed');
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (activeMode) run(activeMode, value);
  };

  const changeDelimiter = (value: string) => {
    setDelimiter(value);
    if (activeMode) run(activeMode, input, value);
  };

  const loadFile = (text: string, name: string) => {
    setInput(text);
    setError('');
    const ext = fileExt(name);
    // Pick the natural direction from the file type; a .tsv also sets the delimiter.
    if (ext === 'json') {
      run('toCsv', text);
    } else if (ext === 'tsv') {
      setDelimiter('\t');
      run('toJson', text, '\t');
    } else {
      run('toJson', text);
    }
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError('');
    setActiveMode(null);
  };

  // Parse the CSV output back into a grid for the table preview (JSON → CSV only).
  const previewRows = activeMode === 'toCsv' && output ? parseCsv(output, delimiter) : [];
  const previewHeader = previewRows[0] ?? [];
  const previewBody = previewRows.slice(1);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LoadFileButton
          onLoad={loadFile}
          accept=".csv,.tsv,.json,.txt,text/csv,application/json,text/plain"
          label="Load .csv / .json file"
        />
      </div>
      <TextArea
        label="Input"
        value={input}
        onChange={e => handleInputChange(e.target.value)}
        placeholder={'name,age\nAlice,30\nBob,25'}
        rows={10}
      />

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Delimiter
        </span>
        <div className="flex flex-wrap gap-2">
          {DELIMITERS.map(d => (
            <Button
              key={d.value}
              variant={delimiter === d.value ? 'primary' : 'secondary'}
              aria-pressed={delimiter === d.value}
              onClick={() => changeDelimiter(d.value)}
            >
              {d.label}
            </Button>
          ))}
        </div>
      </div>

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

      {error && <Alert variant="error">{error}</Alert>}

      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Result</span>
            <CopyButton value={output} />
          </div>
          <CodeBlock code={output} language={activeMode === 'toJson' ? 'json' : 'plaintext'} />
        </div>
      )}

      {previewHeader.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-muted-foreground">
            Table preview
            {previewBody.length > PREVIEW_ROWS && ` (first ${PREVIEW_ROWS} of ${previewBody.length} rows)`}
          </span>
          <div className="max-h-[30rem] overflow-auto border-2 border-border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0">
                <tr>
                  {previewHeader.map((cell, c) => (
                    <th key={c} className="border-2 border-border bg-muted px-3 py-2 text-left font-bold">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewBody.slice(0, PREVIEW_ROWS).map((row, r) => (
                  <tr key={r}>
                    {previewHeader.map((_, c) => (
                      <td key={c} className="border-2 border-border px-3 py-1.5">
                        {row[c] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
