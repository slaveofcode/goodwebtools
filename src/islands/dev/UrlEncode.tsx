import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import type { Lang } from '@/i18n/config';

type Mode = 'encode' | 'decode';

const TR: Record<Lang, {
  inputLabel: string;
  encode: string;
  decode: string;
  clear: string;
  invalidInput: string;
  result: string;
}> = {
  en: {
    inputLabel: 'Input',
    encode: 'Encode →',
    decode: '← Decode',
    clear: 'Clear',
    invalidInput: 'Invalid input for URL decoding',
    result: 'Result',
  },
  id: {
    inputLabel: 'Input',
    encode: 'Encode →',
    decode: '← Decode',
    clear: 'Bersihkan',
    invalidInput: 'Input tidak valid untuk decoding URL',
    result: 'Hasil',
  },
};

export default function UrlEncode({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [activeMode, setActiveMode] = useState<Mode | null>(null);

  const run = (mode: Mode, source = input) => {
    setActiveMode(mode);
    setError('');
    if (!source) {
      setOutput('');
      return;
    }
    try {
      setOutput(mode === 'encode' ? encodeURIComponent(source) : decodeURIComponent(source));
    } catch {
      setOutput('');
      setError(t.invalidInput);
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
        label={t.inputLabel}
        value={input}
        onChange={e => handleInputChange(e.target.value)}
        placeholder="https://example.com/?q=hello world"
        monospace={false}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeMode === 'encode' ? 'primary' : 'secondary'}
          aria-pressed={activeMode === 'encode'}
          onClick={() => run('encode')}
        >
          {t.encode}
        </Button>
        <Button
          variant={activeMode === 'decode' ? 'primary' : 'secondary'}
          aria-pressed={activeMode === 'decode'}
          onClick={() => run('decode')}
        >
          {t.decode}
        </Button>
        <Button variant="ghost" onClick={clear}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{t.result}</span>
            <CopyButton value={output} />
          </div>
          <pre className="max-h-[20rem] overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <code>{output}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
