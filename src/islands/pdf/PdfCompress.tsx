import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { compressPdf } from '@/tools/pdf/pdf.lib';
import { formatBytes } from '@/tools/image/canvas.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  dropTitle: string;
  dropSubtitle: string;
  compressing: string;
  compressPdf: string;
  clear: string;
  result: string;
  smaller: (n: number) => string;
  alreadyOptimal: string;
  alreadyCompressed: string;
  compressionFailed: string;
}> = {
  en: {
    dropTitle: 'Drop a PDF here or click to browse',
    dropSubtitle: 'Recompress streams, images, and fonts; drop unused objects',
    compressing: 'Compressing…',
    compressPdf: 'Compress PDF',
    clear: 'Clear',
    result: 'Result',
    smaller: (n) => `−${n}% smaller`,
    alreadyOptimal: 'already optimal',
    alreadyCompressed:
      'This PDF is already well-compressed (mostly text/vector). Compression helps most on image-heavy PDFs.',
    compressionFailed: 'Compression failed',
  },
  id: {
    dropTitle: 'Letakkan PDF di sini atau klik untuk memilih',
    dropSubtitle: 'Kompres ulang stream, gambar, dan font; buang objek yang tidak terpakai',
    compressing: 'Mengompres…',
    compressPdf: 'Kompres PDF',
    clear: 'Bersihkan',
    result: 'Hasil',
    smaller: (n) => `−${n}% lebih kecil`,
    alreadyOptimal: 'sudah optimal',
    alreadyCompressed:
      'PDF ini sudah terkompres dengan baik (sebagian besar teks/vektor). Kompresi paling efektif pada PDF yang banyak gambar.',
    compressionFailed: 'Kompresi gagal',
  },
};

export default function PdfCompress({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
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
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await compressPdf(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.compressionFailed);
    } finally {
      setBusy(false);
    }
  };

  const reduction =
    file && result ? Math.round((1 - result.size / file.size) * 100) : null;

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropTitle}</p>
          <p className="text-sm text-muted-foreground">
            {t.dropSubtitle}
          </p>
        </div>
      </Dropzone>

      {file && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? t.compressing : t.compressPdf}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span className="font-mono">{formatBytes(result.size)}</span>
            {reduction !== null && (
              <span
                className={
                  reduction > 0
                    ? 'font-bold text-green-600 dark:text-green-400'
                    : 'font-bold text-muted-foreground'
                }
              >
                {reduction > 0 ? t.smaller(reduction) : t.alreadyOptimal}
              </span>
            )}
          </div>
          {reduction !== null && reduction <= 0 && (
            <Alert variant="success">
              {t.alreadyCompressed}
            </Alert>
          )}
          <PdfPreview source={result} />
          <ResultActions blob={result} filename="compressed.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
