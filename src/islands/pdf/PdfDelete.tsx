import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { deletePages, getPageCount, parsePageSpec } from '@/tools/pdf/pdf.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  dropTitle: string;
  dropSubtitle: string;
  reading: string;
  pagesLabel: string;
  placeholder: string;
  removing: string;
  removePages: string;
  clear: string;
  errRead: string;
  errEnter: string;
  errDelete: string;
  pagesCount: (n: number) => string;
}> = {
  en: {
    dropTitle: 'Drop a PDF here or click to browse',
    dropSubtitle: "Remove pages you don't need",
    reading: 'Reading PDF… (first use loads the PDF engine)',
    pagesLabel: 'Pages to remove',
    placeholder: 'e.g. 1, 3, 5-7',
    removing: 'Removing…',
    removePages: 'Remove pages',
    clear: 'Clear',
    errRead: 'Could not read this PDF.',
    errEnter: 'Enter pages to remove, e.g. 1, 3, 5-7',
    errDelete: 'Delete failed',
    pagesCount: (n) => `${n} pages`,
  },
  id: {
    dropTitle: 'Letakkan PDF di sini atau klik untuk menjelajah',
    dropSubtitle: 'Hapus halaman yang tidak Anda perlukan',
    reading: 'Membaca PDF… (penggunaan pertama memuat mesin PDF)',
    pagesLabel: 'Halaman yang akan dihapus',
    placeholder: 'mis. 1, 3, 5-7',
    removing: 'Menghapus…',
    removePages: 'Hapus halaman',
    clear: 'Bersihkan',
    errRead: 'Tidak dapat membaca PDF ini.',
    errEnter: 'Masukkan halaman yang akan dihapus, mis. 1, 3, 5-7',
    errDelete: 'Penghapusan gagal',
    pagesCount: (n) => `${n} halaman`,
  },
};

export default function PdfDelete({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [spec, setSpec] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const pdf = files[0];
    if (!pdf) return;
    setError('');
    setResult(null);
    setFile(pdf);
    setReading(true);
    try {
      setPageCount(await getPageCount(pdf));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errRead);
      setFile(null);
    } finally {
      setReading(false);
    }
  };

  const run = async () => {
    if (!file) return;
    const list = parsePageSpec(spec);
    if (list.length === 0) {
      setError(t.errEnter);
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await deletePages(file, list));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errDelete);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropTitle}</p>
          <p className="text-sm text-muted-foreground">{t.dropSubtitle}</p>
        </div>
      </Dropzone>

      {reading && (
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.reading}
        </p>
      )}

      {file && (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{file.name}</span> — {t.pagesCount(pageCount)}
          </p>
          <TextArea
            label={t.pagesLabel}
            value={spec}
            onChange={e => setSpec(e.target.value)}
            placeholder={t.placeholder}
            rows={1}
          />
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? t.removing : t.removePages}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setSpec(''); setPageCount(0); }}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <>
          <PdfPreview source={result} />
          <ResultActions blob={result} filename="edited.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
