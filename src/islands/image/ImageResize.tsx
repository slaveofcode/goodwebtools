import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { processImage, scaleToWidth, scaleToHeight } from '@/tools/image/canvas.lib';

function outputFormat(type: string): { mime: string; ext: string } {
  if (type === 'image/jpeg') return { mime: 'image/jpeg', ext: 'jpg' };
  if (type === 'image/webp') return { mime: 'image/webp', ext: 'webp' };
  return { mime: 'image/png', ext: 'png' };
}

export default function ImageResize() {
  const [file, setFile] = useState<File | null>(null);
  const [orig, setOrig] = useState<{ w: number; h: number } | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lock, setLock] = useState(true);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const image = files.find(f => f.type.startsWith('image/'));
    if (!image) return;
    setError('');
    setResult(null);
    setFile(image);
    try {
      const bitmap = await createImageBitmap(image);
      setOrig({ w: bitmap.width, h: bitmap.height });
      setWidth(bitmap.width);
      setHeight(bitmap.height);
      bitmap.close?.();
    } catch {
      setError('Could not read this image.');
      setFile(null);
    }
  };

  const changeWidth = (value: number) => {
    setWidth(value);
    if (lock && orig) setHeight(scaleToWidth(orig.w, orig.h, value));
  };
  const changeHeight = (value: number) => {
    setHeight(value);
    if (lock && orig) setWidth(scaleToHeight(orig.w, orig.h, value));
  };

  const fmt = outputFormat(file?.type ?? '');
  const outName = file
    ? file.name.replace(/\.[^.]+$/, '') + `-${width}x${height}.` + fmt.ext
    : `resized.${fmt.ext}`;

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
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">Resize to exact pixel dimensions</p>
        </div>
      </Dropzone>

      {file && orig && (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{file.name}</span> — original {orig.w}×
            {orig.h}
          </p>
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
              <input
                type="checkbox"
                checked={lock}
                onChange={() => setLock(prev => !prev)}
                className="accent-accent"
              />
              Lock aspect ratio
            </label>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? 'Resizing…' : 'Resize'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setOrig(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} originalSize={file?.size} />}
    </div>
  );
}
