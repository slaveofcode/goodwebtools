import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { LoadFileButton } from '@/components/ui/LoadFileButton';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { DownloadTextButton } from '@/components/ui/DownloadTextButton';
import type { Lang } from '@/i18n/config';

type Mode = 'format2' | 'format4' | 'minify';

const MODE_INDENT: Record<Mode, number> = {
  format2: 2,
  format4: 4,
  minify: 0,
};

const TR: Record<Lang, {
  loadFile: string;
  inputLabel: string;
  format2: string;
  format4: string;
  minify: string;
  clear: string;
  invalidJson: string;
  result: string;
}> = {
  en: {
    loadFile: 'Load .json file',
    inputLabel: 'Input JSON',
    format2: 'Format (2 spaces)',
    format4: 'Format (4 spaces)',
    minify: 'Minify',
    clear: 'Clear',
    invalidJson: 'Invalid JSON',
    result: 'Result',
  },
  id: {
    loadFile: 'Muat file .json',
    inputLabel: 'Input JSON',
    format2: 'Format (2 spasi)',
    format4: 'Format (4 spasi)',
    minify: 'Minify',
    clear: 'Bersihkan',
    invalidJson: 'JSON tidak valid',
    result: 'Hasil',
  },
};

export default function JsonFormat({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const MODE_LABELS: { mode: Mode; label: string }[] = [
    { mode: 'format2', label: t.format2 },
    { mode: 'format4', label: t.format4 },
    { mode: 'minify', label: t.minify },
  ];
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
      setError(e instanceof Error ? e.message : t.invalidJson);
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
        <LoadFileButton onLoad={loadFile} accept=".json,application/json,.txt,text/plain" label={t.loadFile} />
      </div>
      <TextArea
        label={t.inputLabel}
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
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{t.result}</span>
            <div className="flex gap-2">
              <DownloadTextButton text={output} filename="formatted.json" mime="application/json" />
              <CopyButton value={output} />
            </div>
          </div>
          <CodeBlock code={output} language="json" />
        </div>
      )}
    </div>
  );
}
