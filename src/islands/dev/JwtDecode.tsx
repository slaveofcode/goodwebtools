import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
  const binary = atob(base64 + padding);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function prettyJson(raw: string): string {
  return JSON.stringify(JSON.parse(raw), null, 2);
}

export default function JwtDecode() {
  const [input, setInput] = useState('');
  const [header, setHeader] = useState('');
  const [payload, setPayload] = useState('');
  const [error, setError] = useState('');

  const decode = () => {
    setError('');
    setHeader('');
    setPayload('');
    const token = input.trim();
    if (!token) return;

    const parts = token.split('.');
    if (parts.length < 2) {
      setError('Not a valid JWT — expected at least two dot-separated segments.');
      return;
    }
    try {
      setHeader(prettyJson(base64UrlDecode(parts[0])));
      setPayload(prettyJson(base64UrlDecode(parts[1])));
    } catch {
      setError('Failed to decode token segments.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={decode}>Decode</Button>
        <Button variant="ghost" onClick={() => { setInput(''); setHeader(''); setPayload(''); setError(''); }}>
          Clear
        </Button>
      </div>

      <TextArea
        label="JWT"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature"
        rows={4}
      />

      <p className="text-xs text-muted-foreground">
        Decoding only — the signature is <strong>not</strong> verified. Nothing leaves your browser.
      </p>

      {error && <Alert variant="error">{error}</Alert>}

      {header && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Header</span>
            <CopyButton value={header} />
          </div>
          <pre className="overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <code>{header}</code>
          </pre>
        </div>
      )}

      {payload && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Payload</span>
            <CopyButton value={payload} />
          </div>
          <pre className="overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <code>{payload}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
