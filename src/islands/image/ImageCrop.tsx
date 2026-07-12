import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { cropImage, keepFormat } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Mode = 'draw' | 'body' | 'nw' | 'ne' | 'sw' | 'se';
const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;

export default function ImageCrop() {
  const imgRef = useRef<HTMLImageElement>(null);
  const action = useRef<{ mode: Mode; sx: number; sy: number; start: Rect } | null>(null);
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

  usePasteImage(f => onDrop([f]));

  // Seed a centered default selection once the image lays out.
  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setSel({ x: img.clientWidth * 0.2, y: img.clientHeight * 0.2, w: img.clientWidth * 0.6, h: img.clientHeight * 0.6 });
  };

  const rel = (e: React.PointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
    return { x: clamp(e.clientX - r.left, r.width), y: clamp(e.clientY - r.top, r.height), W: r.width, H: r.height };
  };
  const norm = (x1: number, y1: number, x2: number, y2: number): Rect => ({
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  });

  const onDown = (e: React.PointerEvent) => {
    const role = (e.target as HTMLElement).dataset.role as Mode | undefined;
    const p = rel(e);
    if (role && sel) {
      action.current = { mode: role, sx: p.x, sy: p.y, start: sel };
    } else {
      action.current = { mode: 'draw', sx: p.x, sy: p.y, start: { x: p.x, y: p.y, w: 0, h: 0 } };
      setSel({ x: p.x, y: p.y, w: 0, h: 0 });
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: React.PointerEvent) => {
    const a = action.current;
    if (!a) return;
    const p = rel(e);
    const s = a.start;
    if (a.mode === 'draw') {
      setSel(norm(a.sx, a.sy, p.x, p.y));
    } else if (a.mode === 'body') {
      const nx = Math.max(0, Math.min(s.x + (p.x - a.sx), p.W - s.w));
      const ny = Math.max(0, Math.min(s.y + (p.y - a.sy), p.H - s.h));
      setSel({ ...s, x: nx, y: ny });
    } else {
      let left = s.x;
      let top = s.y;
      let right = s.x + s.w;
      let bottom = s.y + s.h;
      if (a.mode.includes('w')) left = p.x;
      if (a.mode.includes('e')) right = p.x;
      if (a.mode.includes('n')) top = p.y;
      if (a.mode.includes('s')) bottom = p.y;
      setSel(norm(left, top, right, bottom));
    }
  };
  const onUp = () => {
    action.current = null;
  };

  const scale = imgRef.current ? imgRef.current.naturalWidth / imgRef.current.clientWidth : 1;
  const natW = sel ? Math.round(sel.w * scale) : 0;
  const natH = sel ? Math.round(sel.h * scale) : 0;

  const crop = async () => {
    const img = imgRef.current;
    if (!file || !img || !sel || sel.w < 2 || sel.h < 2) {
      setError('Draw or adjust a selection first.');
      return;
    }
    const s = img.naturalWidth / img.clientWidth;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await cropImage(file, {
        x: sel.x * s,
        y: sel.y * s,
        width: sel.w * s,
        height: sel.h * s,
      });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crop failed');
    } finally {
      setBusy(false);
    }
  };

  const outName = file
    ? file.name.replace(/\.[^.]+$/, '') + `-${natW}x${natH}.` + keepFormat(file.type).ext
    : 'cropped.png';

  return (
    <div className="space-y-4">
      {!file && (
        <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">Drop an image or click to browse</p>
            <p className="text-sm text-muted-foreground">Drag the crop box; resize it from the corners · or paste (⌘V)</p>
          </div>
        </Dropzone>
      )}

      {file && srcUrl && (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{file.name}</span> — drag the box to move,
            corners to resize · {natW}×{natH}
          </p>
          <div
            className="relative inline-block max-w-full touch-none select-none overflow-hidden border-2 border-border bg-muted"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            <img
              ref={imgRef}
              src={srcUrl}
              alt="Source"
              draggable={false}
              onLoad={onImgLoad}
              className="block h-auto w-auto min-w-[70vw] max-w-full"
            />
            {sel && sel.w > 0 && sel.h > 0 && (
              <>
                {/* Dim only the image area outside the selection (4 rects). */}
                <div className="pointer-events-none absolute bg-black/45" style={{ left: 0, top: 0, right: 0, height: sel.y }} />
                <div className="pointer-events-none absolute bg-black/45" style={{ left: 0, right: 0, top: sel.y + sel.h, bottom: 0 }} />
                <div className="pointer-events-none absolute bg-black/45" style={{ left: 0, top: sel.y, width: sel.x, height: sel.h }} />
                <div className="pointer-events-none absolute bg-black/45" style={{ left: sel.x + sel.w, right: 0, top: sel.y, height: sel.h }} />
                {/* Movable selection body */}
                <div
                  data-role="body"
                  className="absolute cursor-move border-2 border-accent"
                  style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
                />
                {CORNERS.map(role => {
                  const pos = {
                    nw: { left: sel.x, top: sel.y },
                    ne: { left: sel.x + sel.w, top: sel.y },
                    sw: { left: sel.x, top: sel.y + sel.h },
                    se: { left: sel.x + sel.w, top: sel.y + sel.h },
                  }[role];
                  const cursor = role === 'nw' || role === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize';
                  return (
                    <div
                      key={role}
                      data-role={role}
                      className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 border-2 border-border bg-accent ${cursor}`}
                      style={{ left: pos.left, top: pos.top }}
                    />
                  );
                })}
              </>
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
