import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { ResultActions } from '@/components/ui/ResultActions';
import { repairPdf } from '@/tools/pdf/pdf.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  couldNotRepair: string;
  dropTitle: string;
  dropHint: string;
  repairing: string;
  repairPdf: string;
  forceRebuildTitle: string;
  forceRebuild: string;
  clear: string;
  helperPre: string;
  helperMid: string;
  helperPost: string;
  errorPre: string;
  errorPost: string;
  success: (forced: boolean, pages: number) => string;
}> = {
  en: {
    couldNotRepair: 'Could not repair this PDF.',
    dropTitle: 'Drop a damaged PDF here or click to browse',
    dropHint: 'Rebuilds a broken PDF so it opens again · 100% on your device, no upload',
    repairing: 'Repairing…',
    repairPdf: 'Repair PDF',
    forceRebuildTitle: 'Rebuild the document page-by-page — for badly damaged files',
    forceRebuild: 'Force rebuild',
    clear: 'Clear',
    helperPre: 'Repair fixes structural damage (a broken cross-reference table, damaged trailer, junk after the end of the file). If a normal repair doesn’t open, try ',
    helperMid: 'Force rebuild',
    helperPost: ', which reconstructs the file from whatever pages are still readable. Content that’s physically missing can’t be recovered.',
    errorPre: ' You can try ',
    errorPost: ' for a more aggressive recovery.',
    success: (forced, pages) => `${forced ? 'Rebuilt' : 'Repaired'} — ${pages} page${pages === 1 ? '' : 's'} recovered. Check the preview before saving.`,
  },
  id: {
    couldNotRepair: 'Tidak dapat memperbaiki PDF ini.',
    dropTitle: 'Letakkan PDF yang rusak di sini atau klik untuk memilih',
    dropHint: 'Membangun ulang PDF yang rusak agar bisa dibuka lagi · 100% di perangkat Anda, tanpa unggah',
    repairing: 'Memperbaiki…',
    repairPdf: 'Perbaiki PDF',
    forceRebuildTitle: 'Bangun ulang dokumen halaman demi halaman — untuk file yang rusak parah',
    forceRebuild: 'Bangun ulang paksa',
    clear: 'Bersihkan',
    helperPre: 'Perbaikan mengatasi kerusakan struktural (tabel referensi silang yang rusak, trailer rusak, data sampah setelah akhir file). Jika perbaikan biasa tidak dapat membuka file, coba ',
    helperMid: 'Bangun ulang paksa',
    helperPost: ', yang merekonstruksi file dari halaman apa pun yang masih dapat dibaca. Konten yang benar-benar hilang tidak dapat dipulihkan.',
    errorPre: ' Anda dapat mencoba ',
    errorPost: ' untuk pemulihan yang lebih agresif.',
    success: (forced, pages) => `${forced ? 'Dibangun ulang' : 'Diperbaiki'} — ${pages} halaman dipulihkan. Periksa pratinjau sebelum menyimpan.`,
  },
};

export default function PdfRepair({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [pages, setPages] = useState(0);
  const [forced, setForced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    const pdf = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) return;
    setFile(pdf);
    setResult(null);
    setError('');
  };

  const outName = file ? file.name.replace(/\.pdf$/i, '') + '-repaired.pdf' : 'repaired.pdf';

  const run = async (force: boolean) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob, pages: recovered } = await repairPdf(file, force);
      setResult(blob);
      setPages(recovered);
      setForced(force);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.couldNotRepair);
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

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run(false)} disabled={!file || busy}>
          {busy ? t.repairing : t.repairPdf}
        </Button>
        <Button variant="secondary" onClick={() => run(true)} disabled={!file || busy} title={t.forceRebuildTitle}>
          {t.forceRebuild}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          {t.clear}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.helperPre}<strong>{t.helperMid}</strong>{t.helperPost}
      </p>

      {error && (
        <Alert variant="error">
          {error}{t.errorPre}<strong>{t.forceRebuild}</strong>{t.errorPost}
        </Alert>
      )}

      {result && (
        <>
          <Alert variant="success">
            {t.success(forced, pages)}
          </Alert>
          <PdfPreview source={result} />
          <ResultActions blob={result} filename={outName} disabled={busy} />
        </>
      )}
    </div>
  );
}
