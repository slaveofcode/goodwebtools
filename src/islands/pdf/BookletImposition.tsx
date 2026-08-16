import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ResultActions } from '@/components/ui/ResultActions';
import { bookletOrder, paddedCount } from '@/tools/pdf/booklet.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Rearrange a PDF into a saddle-stitch booklet: print it double-sided, fold the stack in half, and the pages read in order. Two pages are placed per sheet side. Everything runs in your browser.',
    drop: 'Drop a PDF or click to browse', dropSub: 'Imposed on your device',
    failed: 'Something went wrong.', pages: 'pages', sheets: 'sheets', blanks: 'blank pages added',
    make: 'Make booklet', working: 'Imposing…',
    hint: 'Print the result double-sided (flip on the short edge), then fold in half.',
  },
  id: {
    intro: 'Susun ulang PDF menjadi booklet jahit-pelana: cetak bolak-balik, lipat tumpukan jadi dua, dan halaman terbaca berurutan. Dua halaman ditempatkan per sisi lembar. Semuanya berjalan di browser Anda.',
    drop: 'Letakkan PDF atau klik untuk memilih', dropSub: 'Disusun di perangkat Anda',
    failed: 'Terjadi kesalahan.', pages: 'halaman', sheets: 'lembar', blanks: 'halaman kosong ditambahkan',
    make: 'Buat booklet', working: 'Menyusun…',
    hint: 'Cetak hasilnya bolak-balik (balik pada sisi pendek), lalu lipat jadi dua.',
  },
};

export default function BookletImposition({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Blob | null>(null);

  const onDrop = async (files: File[]) => {
    const f = files.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;
    setFile(f); setResult(null); setError(''); setBusy(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(await f.arrayBuffer());
      setPageCount(doc.getPageCount());
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const make = async () => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const src = await PDFDocument.load(await file.arrayBuffer());
      const out = await PDFDocument.create();
      const order = bookletOrder(src.getPageCount());
      const first = src.getPage(0);
      const pw = first.getWidth();
      const ph = first.getHeight();
      for (let i = 0; i < order.length; i += 2) {
        const sheet = out.addPage([pw * 2, ph]);
        for (let side = 0; side < 2; side++) {
          const srcNum = order[i + side];
          if (!srcNum) continue;
          const embedded = await out.embedPage(src.getPage(srcNum - 1));
          sheet.drawPage(embedded, { x: side * pw, y: 0, width: pw, height: ph });
        }
      }
      const bytes = await out.save();
      setResult(new Blob([bytes], { type: 'application/pdf' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const padded = paddedCount(pageCount);
  const blanks = padded - pageCount;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!file && (
        <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {file && pageCount > 0 && !result && (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-bold">{file.name}</span>{' '}
            <span className="text-muted-foreground">· {pageCount} {t.pages} → {padded / 4} {t.sheets}{blanks > 0 ? `, ${blanks} ${t.blanks}` : ''}</span>
          </p>
          <p className="text-xs text-muted-foreground">{t.hint}</p>
          <Button onClick={make} disabled={busy}>{busy ? t.working : t.make}</Button>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t.hint}</p>
          <ResultActions blob={result} filename={file ? file.name.replace(/\.pdf$/i, '') + '-booklet.pdf' : 'booklet.pdf'} disabled={busy} />
        </div>
      )}
    </div>
  );
}
