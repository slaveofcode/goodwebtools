import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { usePasteImage } from '@/hooks/usePasteImage';
import { applyCleanup, rotate90 } from '@/tools/image/ocr-preprocess.lib';
import { recognize, OcrError, type OcrResult } from '@/tools/image/ocr.lib';
import { getPdfPageCount, renderPdfPage } from '@/tools/image/ocr-pdf.lib';
import CameraCapture from './CameraCapture';
import type { Lang } from '@/i18n/config';

const MAX_DIM = 2000;

const TR: Record<Lang, {
  errLoadFile: string; errRenderPage: string; errOcr: string;
  dropTitle: string; dropDesc: string; useCamera: string;
  prev: string; page: string; next: string; rotate: string; cleanup: string;
  threshold: string; runOcr: string; reading: string; extracting: string; retry: string;
}> = {
  en: {
    errLoadFile: 'Could not load that file.',
    errRenderPage: 'Could not render that page.',
    errOcr: 'OCR failed.',
    dropTitle: 'Drop an image or PDF, or click to browse',
    dropDesc: 'Runs on-device · or paste (⌘V). First use downloads the OCR model once.',
    useCamera: 'Use camera',
    prev: 'Prev', page: 'Page', next: 'Next', rotate: 'Rotate 90°',
    cleanup: 'Clean up image', threshold: 'Threshold',
    runOcr: 'Run OCR', reading: 'Reading…',
    extracting: 'Extracting text… (first run downloads the OCR model once)',
    retry: 'Retry',
  },
  id: {
    errLoadFile: 'Tidak dapat memuat berkas itu.',
    errRenderPage: 'Tidak dapat menampilkan halaman itu.',
    errOcr: 'OCR gagal.',
    dropTitle: 'Letakkan gambar atau PDF, atau klik untuk memilih',
    dropDesc: 'Berjalan di perangkat · atau tempel (⌘V). Penggunaan pertama mengunduh model OCR sekali.',
    useCamera: 'Gunakan kamera',
    prev: 'Sebelumnya', page: 'Halaman', next: 'Berikutnya', rotate: 'Putar 90°',
    cleanup: 'Bersihkan gambar', threshold: 'Ambang',
    runOcr: 'Jalankan OCR', reading: 'Membaca…',
    extracting: 'Mengekstrak teks… (penggunaan pertama mengunduh model OCR sekali)',
    retry: 'Coba lagi',
  },
};

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return ctx.getImageData(0, 0, w, h);
}

function buildAdjusted(
  base: ImageData,
  opts: { quarters: number; cleanup: boolean; threshold: number },
): HTMLCanvasElement {
  let img = base;
  for (let i = 0; i < opts.quarters; i++) img = rotate90(img);
  if (opts.cleanup) img = applyCleanup(img, { threshold: opts.threshold });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  const sink = ctx.createImageData(img.width, img.height);
  sink.data.set(img.data);
  ctx.putImageData(sink, 0, 0);
  return canvas;
}

export default function OcrWorkbench({
  onResult,
  onReset,
  lang = 'en',
}: {
  onResult: (result: OcrResult) => void;
  onReset: () => void;
  lang?: Lang;
}) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [base, setBase] = useState<ImageData | null>(null);
  const [quarters, setQuarters] = useState(0);
  const [cleanup, setCleanup] = useState(false);
  const [threshold, setThreshold] = useState(140);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  const reset = () => {
    setBase(null); setError(''); setRetryable(false);
    setQuarters(0); setCleanup(false); setPage(1); setPageCount(0);
    onReset();
  };

  const onDrop = async (files: File[]) => {
    const f = files.find((x) => x.type.startsWith('image/') || x.type === 'application/pdf') ?? null;
    reset();
    setFile(f);
    if (!f) return;
    const pdf = f.type === 'application/pdf';
    setIsPdf(pdf);
    try {
      if (pdf) {
        setPageCount(await getPdfPageCount(f));
        setBase(await blobToImageData(await renderPdfPage(f, 1)));
      } else {
        setBase(await blobToImageData(f));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errLoadFile);
    }
  };
  usePasteImage((f) => onDrop([f]));

  useEffect(() => {
    if (!file || !isPdf || pageCount === 0) return;
    let alive = true;
    renderPdfPage(file, page)
      .then(blobToImageData)
      .then((d) => alive && setBase(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : t.errRenderPage));
    return () => { alive = false; };
  }, [file, isPdf, page, pageCount]);

  useEffect(() => {
    if (!base || !previewRef.current) return;
    const canvas = buildAdjusted(base, { quarters, cleanup, threshold });
    const el = previewRef.current;
    el.width = canvas.width;
    el.height = canvas.height;
    el.getContext('2d')?.drawImage(canvas, 0, 0);
  }, [base, quarters, cleanup, threshold]);

  const runOcr = async () => {
    if (!base) return;
    setBusy(true); setError(''); setRetryable(false);
    try {
      const result = await recognize(buildAdjusted(base, { quarters, cleanup, threshold }));
      onResult(result);
    } catch (e) {
      if (e instanceof OcrError) {
        setError(e.message);
        setRetryable(e.reason === 'model-download');
      } else {
        setError(e instanceof Error ? e.message : t.errOcr);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {cameraOpen ? (
        <CameraCapture
          onCapture={(f) => { setCameraOpen(false); onDrop([f]); }}
          onCancel={() => setCameraOpen(false)}
          lang={lang}
        />
      ) : (
        <div className="space-y-2">
          <Dropzone onDrop={onDrop} accept="image/*,application/pdf" multiple={false}>
            <div className="space-y-1">
              <p className="text-lg font-bold">{t.dropTitle}</p>
              <p className="text-sm text-muted-foreground">{t.dropDesc}</p>
            </div>
          </Dropzone>
          <Button variant="secondary" onClick={() => setCameraOpen(true)}>{t.useCamera}</Button>
        </div>
      )}

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      {isPdf && pageCount > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t.prev}</Button>
          <span>{t.page} {page} / {pageCount}</span>
          <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>{t.next}</Button>
        </div>
      )}

      {base && (
        <div className="space-y-3">
          <canvas ref={previewRef} className="max-h-96 w-auto border-2 border-border" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setQuarters((q) => (q + 1) % 4)}>{t.rotate}</Button>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={cleanup} onChange={(e) => setCleanup(e.target.checked)} />
              {t.cleanup}
            </label>
            {cleanup && (
              <label className="flex items-center gap-2 text-sm">
                <span className="uppercase tracking-wide text-muted-foreground">{t.threshold} {threshold}</span>
                <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="accent-accent" />
              </label>
            )}
            <Button onClick={runOcr} disabled={busy}>{busy ? t.reading : t.runOcr}</Button>
          </div>
          {busy && (
            <p className="animate-pulse text-sm text-muted-foreground">
              {t.extracting}
            </p>
          )}
        </div>
      )}

      {error && (
        <Alert variant="error">
          {error}
          {retryable && <> <button className="underline" onClick={runOcr}>{t.retry}</button></>}
        </Alert>
      )}
    </div>
  );
}
