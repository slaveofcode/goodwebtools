import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { LoadFileButton, fileExt } from '@/components/ui/LoadFileButton';

export interface BiConverterProps {
  /** Left-hand format label, e.g. "JSON". */
  leftLabel: string;
  /** Right-hand format label, e.g. "YAML". */
  rightLabel: string;
  /** Convert left → right (may throw on invalid input). */
  toRight: (input: string) => string;
  /** Convert right → left (may throw on invalid input). */
  toLeft: (input: string) => string;
  placeholder?: string;
  /** `accept` for the "Load file" picker, e.g. '.json,.yaml,.yml'. */
  fileAccept?: string;
  /** Extensions (no dot) that map to the right-hand format, e.g. ['yaml','yml']. */
  rightExts?: string[];
}

type Mode = 'toRight' | 'toLeft';

/** A two-way text converter: paste input, pick a direction, copy the result. */
export function BiConverter({ leftLabel, rightLabel, toRight, toLeft, placeholder, fileAccept, rightExts = [] }: BiConverterProps) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode | null>(null);

  const run = (next: Mode, source = input) => {
    setMode(next);
    setError('');
    if (!source.trim()) {
      setOutput('');
      return;
    }
    try {
      setOutput(next === 'toRight' ? toRight(source) : toLeft(source));
    } catch (e) {
      setOutput('');
      setError(e instanceof Error ? e.message : 'Conversion failed');
    }
  };

  const onInput = (value: string) => {
    setInput(value);
    if (mode) run(mode, value);
  };

  const loadFile = (text: string, name: string) => {
    setInput(text);
    setError('');
    // A right-format file (e.g. .yaml) converts to the left (JSON); otherwise left → right.
    run(rightExts.includes(fileExt(name)) ? 'toLeft' : 'toRight', text);
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError('');
    setMode(null);
  };

  return (
    <div className="space-y-4">
      {fileAccept && (
        <div className="flex justify-end">
          <LoadFileButton onLoad={loadFile} accept={fileAccept} label={`Load ${leftLabel} / ${rightLabel} file`} />
        </div>
      )}
      <TextArea
        label="Input"
        value={input}
        onChange={e => onInput(e.target.value)}
        placeholder={placeholder}
        rows={10}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant={mode === 'toRight' ? 'primary' : 'secondary'} aria-pressed={mode === 'toRight'} onClick={() => run('toRight')}>
          {leftLabel} → {rightLabel}
        </Button>
        <Button variant={mode === 'toLeft' ? 'primary' : 'secondary'} aria-pressed={mode === 'toLeft'} onClick={() => run('toLeft')}>
          {rightLabel} → {leftLabel}
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
