import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach(byte => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function decodeBase64(base64: string): string {
  const binary = atob(base64.trim());
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

type Mode = 'encode' | 'decode';

export default function Base64() {
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
      setOutput(mode === 'encode' ? encodeBase64(source) : decodeBase64(source));
    } catch {
      setOutput('');
      setError(mode === 'decode' ? 'Invalid Base64 input' : 'Encoding failed');
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
          variant={activeMode === 'encode' ? 'primary' : 'secondary'}
          aria-pressed={activeMode === 'encode'}
          onClick={() => run('encode')}
        >
          Encode →
        </Button>
        <Button
          variant={activeMode === 'decode' ? 'primary' : 'secondary'}
          aria-pressed={activeMode === 'decode'}
          onClick={() => run('decode')}
        >
          ← Decode
        </Button>
        <Button variant="ghost" onClick={clear}>
          Clear
        </Button>
      </div>

      <TextArea
        label="Input"
        value={input}
        onChange={e => handleInputChange(e.target.value)}
        placeholder="Text to encode, or Base64 to decode"
        monospace={false}
      />

      {error && <Alert variant="error">{error}</Alert>}

      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Result</span>
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
