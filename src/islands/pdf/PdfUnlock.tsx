import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { unlockPdf, pdfNeedsPassword } from '@/tools/pdf/pdf.lib';

export default function PdfUnlock() {
  const [file, setFile] = useState<File | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const pdf = files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (!pdf) return;
    setError('');
    setResult(null);
    setPassword('');
    setFile(pdf);
    setChecking(true);
    try {
      setNeedsPassword(await pdfNeedsPassword(pdf));
    } catch {
      setError('Could not read this PDF.');
      setFile(null);
    } finally {
      setChecking(false);
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await unlockPdf(file, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlock this PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">Remove a password so it opens freely</p>
        </div>
      </Dropzone>

      {checking && (
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Reading PDF…
        </p>
      )}

      {file && !checking && (
        <>
          <p className="text-sm font-bold text-foreground">{file.name}</p>
          {needsPassword ? (
            <div className="flex flex-wrap items-end gap-4">
              <label className="min-w-[14rem] flex-1 space-y-1 text-sm">
                <span className="block font-bold uppercase tracking-wide text-muted-foreground">
                  Password
                </span>
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="off"
                  className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm">
                <input type="checkbox" checked={show} onChange={() => setShow(s => !s)} className="accent-accent" />
                Show
              </label>
            </div>
          ) : (
            <Alert variant="success">This PDF isn't password-protected — nothing to remove.</Alert>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy || (needsPassword && !password)}>
          {busy ? 'Unlocking…' : 'Remove password'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setPassword(''); setNeedsPassword(false); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <>
          <Alert variant="success">Password removed — this copy opens without a password.</Alert>
          <PdfPreview source={result} />
          <ResultActions blob={result} filename="unlocked.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
