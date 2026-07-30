import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { usePasteImage } from '@/hooks/usePasteImage';
import { downloadService } from '@/services/download';
import { applyCleanup, rotate90 } from '@/tools/image/ocr-preprocess.lib';
import { recognize, OcrError } from '@/tools/image/ocr.lib';
import { getPdfPageCount, renderPdfPage } from '@/tools/image/ocr-pdf.lib';

// Oversized inputs are downscaled before inference (memory/perf guard).
const MAX_DIM = 2000;

// Draw a blob to an offscreen canvas (downscaled if huge) and return its ImageData (the "base").
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

// Apply rotation + optional cleanup, returning a canvas ready for OCR/preview.
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

export default function ImageOcr() {
  const [file, setFile] = useState<File | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [base, setBase] = useState<ImageData | null>(null);

  const [quarters, setQuarters] = useState(0);
  const [cleanup, setCleanup] = useState(false); // OFF by default
  const [threshold, setThreshold] = useState(140);

  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [backendNote, setBackendNote] = useState('');
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);

  const previewRef = useRef<HTMLCanvasElement | null>(null);

  const reset = () => {
    setBase(null); setText(''); setError(''); setRetryable(false);
    setQuarters(0); setCleanup(false); setPage(1); setPageCount(0);
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
        const count = await getPdfPageCount(f);
        setPageCount(count);
        setBase(await blobToImageData(await renderPdfPage(f, 1)));
      } else {
        setBase(await blobToImageData(f));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that file.');
    }
  };
  usePasteImage((f) => onDrop([f]));

  // Load a different PDF page.
  useEffect(() => {
    if (!file || !isPdf || pageCount === 0) return;
    let alive = true;
    renderPdfPage(file, page)
      .then(blobToImageData)
      .then((d) => alive && setBase(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not render that page.'));
    return () => { alive = false; };
  }, [file, isPdf, page, pageCount]);

  // Live preview of the adjusted image.
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
    setBusy(true); setError(''); setRetryable(false); setText('');
    try {
      const canvas = buildAdjusted(base, { quarters, cleanup, threshold });
      const result = await recognize(canvas);
      setText(result.text);
      setBackendNote(
        result.backend === 'wasm'
          ? 'Ran in slower CPU (WASM) mode — WebGPU isn’t available in this browser.'
          : '',
      );
    } catch (e) {
      if (e instanceof OcrError) {
        setError(e.message);
        setRetryable(e.reason === 'model-download');
      } else {
        setError(e instanceof Error ? e.message : 'OCR failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const outName = (file?.name.replace(/\.[^.]+$/, '') || 'ocr') + '.txt';
  const download = () => downloadService.download(new Blob([text], { type: 'text/plain' }), outName);

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*,application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or PDF, or click to browse</p>
          <p className="text-sm text-muted-foreground">Runs on-device · or paste (⌘V). First use downloads the OCR model once.</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      {isPdf && pageCount > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span>Page {page} / {pageCount}</span>
          <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {base && (
        <div className="space-y-3">
          <canvas ref={previewRef} className="max-h-96 w-auto border-2 border-border" />

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setQuarters((q) => (q + 1) % 4)}>Rotate 90°</Button>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={cleanup} onChange={(e) => setCleanup(e.target.checked)} />
              Clean up image
            </label>
            {cleanup && (
              <label className="flex items-center gap-2 text-sm">
                <span className="uppercase tracking-wide text-muted-foreground">Threshold {threshold}</span>
                <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="accent-accent" />
              </label>
            )}
            <Button onClick={runOcr} disabled={busy}>{busy ? 'Reading…' : 'Run OCR'}</Button>
          </div>

          {busy && (
            <p className="animate-pulse text-sm text-muted-foreground">
              Extracting text… (first run downloads the OCR model once)
            </p>
          )}
        </div>
      )}

      {error && (
        <Alert variant="error">
          {error}
          {retryable && <> <button className="underline" onClick={runOcr}>Retry</button></>}
        </Alert>
      )}

      {text && (
        <div className="space-y-2">
          {backendNote && <p className="text-xs text-muted-foreground">{backendNote}</p>}
          <TextArea label="Recognized text" value={text} onChange={(e) => setText(e.target.value)} rows={12} />
          <div className="flex gap-2">
            <CopyButton value={text} />
            <Button variant="secondary" onClick={download}>Download .txt</Button>
          </div>
        </div>
      )}
    </div>
  );
}
