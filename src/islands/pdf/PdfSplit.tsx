import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { extractPageList, getPageCount, parsePageSpec } from '@/tools/pdf/pdf.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  dropTitle: string;
  dropHint: string;
  reading: string;
  pagesLabel: (n: number) => string;
  pagesFieldLabel: string;
  placeholder: string;
  willExtractPre: string;
  willExtractPost: string;
  extracting: string;
  extractBtn: string;
  clear: string;
  couldNotRead: string;
  enterPages: string;
  extractFailed: string;
}> = {
  en: {
    dropTitle: 'Drop a PDF here or click to browse',
    dropHint: 'Pick any pages or ranges to extract into a new PDF',
    reading: 'Reading PDF… (first use loads the PDF engine)',
    pagesLabel: (n) => `${n} pages`,
    pagesFieldLabel: 'Pages to extract',
    placeholder: 'e.g. 1, 3, 7, 10  or  2-5, 8',
    willExtractPre: 'Will extract',
    willExtractPost: 'page(s):',
    extracting: 'Extracting…',
    extractBtn: 'Extract pages',
    clear: 'Clear',
    couldNotRead: 'Could not read this PDF.',
    enterPages: 'Enter pages to extract, e.g. 1, 3, 7, 10 or 2-5',
    extractFailed: 'Extract failed',
  },
  id: {
    dropTitle: 'Letakkan PDF di sini atau klik untuk memilih',
    dropHint: 'Pilih halaman atau rentang mana pun untuk diekstrak ke PDF baru',
    reading: 'Membaca PDF… (penggunaan pertama memuat mesin PDF)',
    pagesLabel: (n) => `${n} halaman`,
    pagesFieldLabel: 'Halaman yang akan diekstrak',
    placeholder: 'mis. 1, 3, 7, 10  atau  2-5, 8',
    willExtractPre: 'Akan mengekstrak',
    willExtractPost: 'halaman:',
    extracting: 'Mengekstrak…',
    extractBtn: 'Ekstrak halaman',
    clear: 'Bersihkan',
    couldNotRead: 'Tidak dapat membaca PDF ini.',
    enterPages: 'Masukkan halaman yang akan diekstrak, mis. 1, 3, 7, 10 atau 2-5',
    extractFailed: 'Gagal mengekstrak',
  },
};

export default function PdfSplit({ lang = 'en' }: { lang?: Lang }) {
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
    setSpec('');
    setReading(true);
    try {
      const count = await getPageCount(pdf);
      setPageCount(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.couldNotRead);
      setFile(null);
    } finally {
      setReading(false);
    }
  };

  // Live preview of which pages will be extracted.
  const selected = parsePageSpec(spec).filter(n => n <= pageCount);

  const extract = async () => {
    if (!file) return;
    if (selected.length === 0) {
      setError(t.enterPages);
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await extractPageList(file, selected));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.extractFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropTitle}</p>
          <p className="text-sm text-muted-foreground">
            {t.dropHint}
          </p>
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
            <span className="font-bold text-foreground">{file.name}</span> — {t.pagesLabel(pageCount)}
          </p>
          <TextArea
            label={t.pagesFieldLabel}
            value={spec}
            onChange={e => setSpec(e.target.value)}
            placeholder={t.placeholder}
            rows={1}
          />
          {selected.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t.willExtractPre} <span className="font-bold text-foreground">{selected.length}</span>{' '}
              {t.willExtractPost} {selected.join(', ')}
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={extract} disabled={!file || busy}>
          {busy ? t.extracting : t.extractBtn}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setSpec(''); setPageCount(0); }}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <>
          <PdfPreview source={result} />
          <ResultActions blob={result} filename="extracted.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
