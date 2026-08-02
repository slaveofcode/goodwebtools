import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { unlockPdf, pdfNeedsPassword } from '@/tools/pdf/pdf.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  couldNotRead: string;
  couldNotUnlock: string;
  dropTitle: string;
  dropHint: string;
  readingPdf: string;
  password: string;
  show: string;
  notProtected: string;
  unlocking: string;
  removePassword: string;
  clear: string;
  removedSuccess: string;
}> = {
  en: {
    couldNotRead: 'Could not read this PDF.',
    couldNotUnlock: 'Could not unlock this PDF',
    dropTitle: 'Drop a PDF here or click to browse',
    dropHint: 'Remove a password so it opens freely',
    readingPdf: 'Reading PDF…',
    password: 'Password',
    show: 'Show',
    notProtected: "This PDF isn't password-protected — nothing to remove.",
    unlocking: 'Unlocking…',
    removePassword: 'Remove password',
    clear: 'Clear',
    removedSuccess: 'Password removed — this copy opens without a password.',
  },
  id: {
    couldNotRead: 'Tidak dapat membaca PDF ini.',
    couldNotUnlock: 'Tidak dapat membuka PDF ini',
    dropTitle: 'Letakkan PDF di sini atau klik untuk memilih',
    dropHint: 'Hapus password agar PDF terbuka dengan bebas',
    readingPdf: 'Membaca PDF…',
    password: 'Password',
    show: 'Tampilkan',
    notProtected: 'PDF ini tidak dilindungi password — tidak ada yang perlu dihapus.',
    unlocking: 'Membuka…',
    removePassword: 'Hapus password',
    clear: 'Bersihkan',
    removedSuccess: 'Password dihapus — salinan ini terbuka tanpa password.',
  },
};

export default function PdfUnlock({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
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
      setError(t.couldNotRead);
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
      setError(e instanceof Error ? e.message : t.couldNotUnlock);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropTitle}</p>
          <p className="text-sm text-muted-foreground">{t.dropHint}</p>
        </div>
      </Dropzone>

      {checking && (
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.readingPdf}
        </p>
      )}

      {file && !checking && (
        <>
          <p className="text-sm font-bold text-foreground">{file.name}</p>
          {needsPassword ? (
            <div className="flex flex-wrap items-end gap-4">
              <label className="min-w-[14rem] flex-1 space-y-1 text-sm">
                <span className="block font-bold uppercase tracking-wide text-muted-foreground">
                  {t.password}
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
                {t.show}
              </label>
            </div>
          ) : (
            <Alert variant="success">{t.notProtected}</Alert>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy || (needsPassword && !password)}>
          {busy ? t.unlocking : t.removePassword}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setPassword(''); setNeedsPassword(false); }}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <>
          <Alert variant="success">{t.removedSuccess}</Alert>
          <PdfPreview source={result} />
          <ResultActions blob={result} filename="unlocked.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
