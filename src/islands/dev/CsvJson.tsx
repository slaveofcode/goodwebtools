import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { csvToJson, jsonToCsv } from '@/tools/dev/csv.lib';

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
      <TextArea
        label="Input"
        value={input}
        onChange={e => handleInputChange(e.target.value)}
        placeholder={'name,age\nAlice,30\nBob,25'}
        rows={10}
      />

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
          <pre className="max-h-[30rem] overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <code>{output}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
