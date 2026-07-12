import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { decodeJwt } from '@/tools/dev/jwt.lib';

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
      const { header, payload } = decodeJwt(token);
      setHeader(header);
      setPayload(payload);
    } catch {
      setError('Failed to decode token segments.');
    }
  };

  return (
    <div className="space-y-4">
      <TextArea
        label="JWT"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature"
        rows={4}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={decode}>Decode</Button>
        <Button variant="ghost" onClick={() => { setInput(''); setHeader(''); setPayload(''); setError(''); }}>
          Clear
        </Button>
      </div>

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
