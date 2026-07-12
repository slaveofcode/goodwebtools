import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { Alert } from '@/components/ui/Alert';
import { protectPdf } from '@/tools/pdf/pdf.lib';

// mupdf's save options are comma/equals separated, so a password containing
// those characters would corrupt the option string.
const INVALID = /[,=]/;

export default function PdfProtect() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf')) ?? null);
    setResult(null);
    setError('');
  };

  const run = async () => {
    if (!file) return;
    if (!password) return setError('Enter a password.');
    if (INVALID.test(password)) return setError('Password cannot contain commas or equals signs.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await protectPdf(file, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not protect this PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">Encrypt with a password (AES-256)</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-[14rem] flex-1 space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">
            Password
          </span>
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
          />
        </label>
        <label className="min-w-[14rem] flex-1 space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">
            Confirm
          </span>
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm">
          <input type="checkbox" checked={show} onChange={() => setShow(s => !s)} className="accent-accent" />
          Show
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? 'Encrypting…' : 'Protect PDF'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setPassword(''); setConfirm(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <>
          <Alert variant="success">
            Encrypted — the downloaded PDF now requires this password to open.
          </Alert>
          <ResultActions blob={result} filename="protected.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
