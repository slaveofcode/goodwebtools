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

export default function Base64() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const run = (mode: 'encode' | 'decode') => {
    setError('');
    if (!input) {
      setOutput('');
      return;
    }
    try {
      setOutput(mode === 'encode' ? encodeBase64(input) : decodeBase64(input));
    } catch {
      setOutput('');
      setError(mode === 'decode' ? 'Invalid Base64 input' : 'Encoding failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run('encode')}>Encode →</Button>
        <Button variant="secondary" onClick={() => run('decode')}>← Decode</Button>
        <Button variant="ghost" onClick={() => { setInput(''); setOutput(''); setError(''); }}>
          Clear
        </Button>
      </div>

      <TextArea
        label="Input"
        value={input}
        onChange={e => setInput(e.target.value)}
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
