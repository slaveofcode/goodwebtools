import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { groupRows, toCsv, type TextItem } from '@/tools/pdf/pdf-table.lib';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Extract tables and text from a PDF into a CSV you can open in Excel or Sheets. Best effort: it works well for simple, grid-like tables and less well for complex layouts. Everything runs in your browser.',
    drop: 'Drop a PDF or click to browse', dropSub: 'Extracted on your device',
    failed: 'Could not read this PDF.', extract: 'Extract to CSV', working: 'Extracting…',
    rows: 'rows', download: 'Download CSV', note: 'Best-effort extraction — check the result and adjust in your spreadsheet.',
    empty: 'No selectable text found (this PDF may be scanned images — try OCR first).',
  },
  id: {
    intro: 'Ekstrak tabel dan teks dari PDF menjadi CSV yang bisa dibuka di Excel atau Sheets. Best effort: bekerja baik untuk tabel sederhana seperti grid dan kurang baik untuk tata letak rumit. Semuanya berjalan di browser Anda.',
    drop: 'Letakkan PDF atau klik untuk memilih', dropSub: 'Diekstrak di perangkat Anda',
    failed: 'Tidak dapat membaca PDF ini.', extract: 'Ekstrak ke CSV', working: 'Mengekstrak…',
    rows: 'baris', download: 'Unduh CSV', note: 'Ekstraksi best-effort — periksa hasilnya dan sesuaikan di spreadsheet Anda.',
    empty: 'Tidak ada teks yang bisa diseleksi (PDF ini mungkin gambar hasil pindai — coba OCR dulu).',
  },
};

export default function PdfToExcel({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<string[][]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [empty, setEmpty] = useState(false);

  const onDrop = (files: File[]) => {
    const f = files.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;
    setFile(f); setCsv(''); setPreview([]); setError(''); setEmpty(false);
  };

  const extract = async () => {
    if (!file) return;
    setBusy(true); setError(''); setEmpty(false);
    try {
      const pdfjs = await import('pdfjs-dist');
      const PdfjsWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
      pdfjs.GlobalWorkerOptions.workerPort = new PdfjsWorker();
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const allRows: TextItem[][] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const items: TextItem[] = content.items
          .map((it: unknown) => it as { str: string; transform: number[] })
          .filter(it => it.str && it.str.trim())
          .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
        allRows.push(...groupRows(items, 3));
      }
      pdf.destroy();
      if (allRows.length === 0) { setEmpty(true); return; }
      setCsv(toCsv(allRows));
      setPreview(allRows.slice(0, 15).map(r => r.map(c => c.str)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    downloadService.download(blob, (file ? file.name.replace(/\.pdf$/i, '') : 'table') + '.csv');
  };

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
      {empty && <Alert variant="error">{t.empty}</Alert>}

      {file && !csv && !empty && (
        <div className="space-y-2">
          <p className="text-sm"><span className="font-bold">{file.name}</span></p>
          <p className="text-xs text-muted-foreground">{t.note}</p>
          <Button onClick={extract} disabled={busy}>{busy ? t.working : t.extract}</Button>
        </div>
      )}

      {csv && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={download}>{t.download}</Button>
            <span className="text-xs text-muted-foreground">{t.note}</span>
          </div>
          <div className="max-h-96 overflow-auto border-2 border-border">
            <table className="text-sm">
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-border">
                    {row.map((cell, j) => <td key={j} className="border-r border-border px-2 py-1 align-top">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
