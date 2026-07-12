import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { Alert } from '@/components/ui/Alert';
import { protectPdf } from '@/tools/pdf/pdf.lib';
import { generatePassword } from '@/tools/dev/password.lib';

// mupdf's save options are comma/equals separated, so a password containing
// those characters would corrupt the option string.
const INVALID = /[,=]/;

/**
 * Generate a strong password using the shared password generator, guaranteed
 * to be safe for mupdf's option string (no comma/equals). Retries around the
 * two problematic symbols, falling back to a symbol-free password.
 */
function generateSafePassword(length: number): string {
  const base = {
    length,
    enabled: { lowercase: true, uppercase: true, numbers: true, symbols: true },
    avoidAmbiguous: true,
    minNumbers: 2,
    minSpecial: 2,
  };
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = generatePassword(base);
    if (!INVALID.test(candidate)) return candidate;
  }
  // Fallback: letters + numbers only (never contains comma/equals).
  return generatePassword({ ...base, enabled: { ...base.enabled, symbols: false }, minSpecial: 0 });
}

export default function PdfProtect() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [genLength, setGenLength] = useState(20);

  const generate = () => {
    const pw = generateSafePassword(genLength);
    setPassword(pw);
    setConfirm(pw);
    setShow(true);
    setError('');
  };
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

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={generate}>
          <Wand2 className="h-4 w-4" />
          Generate password
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Length
          <select
            value={genLength}
            onChange={e => setGenLength(Number(e.target.value))}
            className="border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
          >
            {[12, 16, 20, 32].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
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
