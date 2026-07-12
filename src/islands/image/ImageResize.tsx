import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { processImage, scaleToWidth, scaleToHeight } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

const MAX_DISPLAY = 520; // px the "fit" preview occupies

function outputFormat(type: string): { mime: string; ext: string } {
  if (type === 'image/jpeg') return { mime: 'image/jpeg', ext: 'jpg' };
  if (type === 'image/webp') return { mime: 'image/webp', ext: 'webp' };
  return { mime: 'image/png', ext: 'png' };
}

export default function ImageResize() {
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState('');
  const [orig, setOrig] = useState<{ w: number; h: number } | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lock, setLock] = useState(true);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);

  const onDrop = async (files: File[]) => {
    const image = files.find(f => f.type.startsWith('image/'));
    if (!image) return;
    setError('');
    setResult(null);
    setFile(image);
    setSrcUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(image);
    });
    try {
      const bitmap = await createImageBitmap(image);
      setOrig({ w: bitmap.width, h: bitmap.height });
      setFitScale(Math.min(MAX_DISPLAY, bitmap.width) / bitmap.width);
      setWidth(bitmap.width);
      setHeight(bitmap.height);
      bitmap.close?.();
    } catch {
      setError('Could not read this image.');
      setFile(null);
    }
  };

  usePasteImage(f => onDrop([f]));

  const clampDim = (value: number) => Math.max(1, Math.min(value, (orig?.w ?? 1) * 4, 20000));

  const changeWidth = (value: number) => {
    const w = clampDim(value);
    setWidth(w);
    if (lock && orig) setHeight(scaleToWidth(orig.w, orig.h, w));
  };
  const changeHeight = (value: number) => {
    const h = clampDim(value);
    setHeight(h);
    if (lock && orig) setWidth(scaleToHeight(orig.w, orig.h, h));
  };

  // Corner-handle drag → live resize.
  const onHandleDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, w: width, h: height };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const start = drag.current;
    if (!start || !orig) return;
    const nextWidth = clampDim(Math.round((start.w * fitScale + (e.clientX - start.x)) / fitScale));
    if (lock) {
      setWidth(nextWidth);
      setHeight(scaleToWidth(orig.w, orig.h, nextWidth));
    } else {
      const nextHeight = clampDim(
        Math.round((start.h * fitScale + (e.clientY - start.y)) / fitScale)
      );
      setWidth(nextWidth);
      setHeight(nextHeight);
    }
  };
  const onHandleUp = () => {
    drag.current = null;
  };

  const fmt = outputFormat(file?.type ?? '');
  const outName = file
    ? file.name.replace(/\.[^.]+$/, '') + `-${width}x${height}.` + fmt.ext
    : `resized.${fmt.ext}`;
  const scalePct = orig ? Math.round((width / orig.w) * 100) : 100;

  const run = async () => {
    if (!file || width < 1 || height < 1) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await processImage(file, {
        mimeType: fmt.mime,
        quality: fmt.mime === 'image/png' ? undefined : 0.92,
        width,
        height,
      });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resize failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {!file && (
        <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">Drop an image or click to browse</p>
            <p className="text-sm text-muted-foreground">Drag the corner handle or type exact sizes · or paste (⌘V)</p>
          </div>
        </Dropzone>
      )}

      {file && orig && srcUrl && (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{file.name}</span> — original {orig.w}×
            {orig.h}
          </p>

          {/* Live resize preview: image scales as you drag the corner handle. */}
          <div className="overflow-auto border-2 border-dashed border-border bg-muted p-4">
            <div
              className="relative select-none"
              style={{ width: Math.max(1, Math.round(width * fitScale)), height: Math.max(1, Math.round(height * fitScale)) }}
            >
              <img
                src={srcUrl}
                alt="Resize preview"
                draggable={false}
                className="block h-full w-full border-2 border-border bg-white"
              />
              <span className="pointer-events-none absolute left-1 top-1 bg-accent px-1 py-0.5 text-[10px] font-bold text-accent-foreground">
                {width}×{height} · {scalePct}%
              </span>
              <div
                onPointerDown={onHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize border-2 border-border bg-accent shadow-brutal-sm"
                aria-label="Drag to resize"
                role="slider"
                aria-valuenow={width}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="space-y-1 text-sm">
              <span className="block font-bold uppercase tracking-wide text-muted-foreground">
                Width
              </span>
              <input
                type="number"
                min={1}
                value={width}
                onChange={e => changeWidth(Number(e.target.value))}
                className="w-28 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block font-bold uppercase tracking-wide text-muted-foreground">
                Height
              </span>
              <input
                type="number"
                min={1}
                value={height}
                onChange={e => changeHeight(Number(e.target.value))}
                className="w-28 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm">
              <input type="checkbox" checked={lock} onChange={() => setLock(p => !p)} className="accent-accent" />
              Lock aspect ratio
            </label>
            <Button
              variant="secondary"
              onClick={() => { changeWidth(orig.w); if (!lock) setHeight(orig.h); }}
            >
              Reset
            </Button>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? 'Resizing…' : 'Resize'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setSrcUrl(''); setOrig(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} originalSize={file?.size} />}
    </div>
  );
}
