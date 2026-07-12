import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { cropImage, keepFormat } from '@/tools/image/canvas.lib';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function ImageCrop() {
  const imgRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState('');
  const [sel, setSel] = useState<Rect | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);

  const onDrop = (files: File[]) => {
    const image = files.find(f => f.type.startsWith('image/'));
    if (!image) return;
    setError('');
    setResult(null);
    setSel(null);
    setFile(image);
    setSrcUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(image);
    });
  };

  const relPos = (e: React.PointerEvent) => {
    const rect = imgRef.current!.getBoundingClientRect();
    const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
    return { x: clamp(e.clientX - rect.left, rect.width), y: clamp(e.clientY - rect.top, rect.height) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = relPos(e);
    dragStart.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const p = relPos(e);
    const s = dragStart.current;
    setSel({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };
  const onPointerUp = () => {
    dragStart.current = null;
  };

  const crop = async () => {
    const img = imgRef.current;
    if (!file || !img || !sel || sel.w < 2 || sel.h < 2) {
      setError('Drag a selection rectangle on the image first.');
      return;
    }
    const scale = img.naturalWidth / img.clientWidth;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await cropImage(file, {
        x: sel.x * scale,
        y: sel.y * scale,
        width: sel.w * scale,
        height: sel.h * scale,
      });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crop failed');
    } finally {
      setBusy(false);
    }
  };

  const outName = file
    ? file.name.replace(/\.[^.]+$/, '') + '-cropped.' + keepFormat(file.type).ext
    : 'cropped.png';

  return (
    <div className="space-y-4">
      {!file && (
        <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">Drop an image or click to browse</p>
            <p className="text-sm text-muted-foreground">Drag a rectangle to crop</p>
          </div>
        </Dropzone>
      )}

      {file && srcUrl && (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{file.name}</span> — drag on the image to
            select a crop area
          </p>
          <div
            className="relative inline-block max-w-full touch-none border-2 border-border bg-muted"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <img
              ref={imgRef}
              src={srcUrl}
              alt="Source"
              draggable={false}
              className="block max-h-[34rem] w-auto max-w-full select-none"
            />
            {sel && sel.w > 0 && sel.h > 0 && (
              <div
                className="pointer-events-none absolute border-2 border-accent bg-accent/20"
                style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
              />
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={crop} disabled={!file || busy}>
          {busy ? 'Cropping…' : 'Crop'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setSrcUrl(''); setSel(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} originalSize={file?.size} />}
    </div>
  );
}
