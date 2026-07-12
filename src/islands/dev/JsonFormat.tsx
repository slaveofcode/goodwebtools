import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { LoadFileButton } from '@/components/ui/LoadFileButton';

type Mode = 'format2' | 'format4' | 'minify';

const MODE_INDENT: Record<Mode, number> = {
  format2: 2,
  format4: 4,
  minify: 0,
};

const MODE_LABELS: { mode: Mode; label: string }[] = [
  { mode: 'format2', label: 'Format (2 spaces)' },
  { mode: 'format4', label: 'Format (4 spaces)' },
  { mode: 'minify', label: 'Minify' },
];

export default function JsonFormat() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [activeMode, setActiveMode] = useState<Mode | null>(null);

  const process = (mode: Mode, source = input) => {
    setActiveMode(mode);
    setError('');
    if (!source.trim()) {
      setOutput('');
      return;
    }
    try {
      const parsed = JSON.parse(source);
      setOutput(JSON.stringify(parsed, null, MODE_INDENT[mode]));
    } catch (e) {
      setOutput('');
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    // Re-apply the active mode as you type so the result stays in sync.
    if (activeMode) process(activeMode, value);
  };

  const loadFile = (text: string) => {
    setInput(text);
    setError('');
    process(activeMode ?? 'format2', text);
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError('');
    setActiveMode(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LoadFileButton onLoad={loadFile} accept=".json,application/json,.txt,text/plain" label="Load .json file" />
      </div>
      <TextArea
        label="Input JSON"
        value={input}
        onChange={e => handleInputChange(e.target.value)}
        placeholder='{"hello": "world"}'
        rows={10}
      />

      <div className="flex flex-wrap gap-2">
        {MODE_LABELS.map(({ mode, label }) => (
          <Button
            key={mode}
            variant={activeMode === mode ? 'primary' : 'secondary'}
            aria-pressed={activeMode === mode}
            onClick={() => process(mode)}
          >
            {label}
          </Button>
        ))}
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
