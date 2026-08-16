import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { usePasteImage } from '@/hooks/usePasteImage';
import { computeHomography, applyHomography, type Point } from '@/tools/image/perspective.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Straighten and crop a photo of a document. Drag the four corners onto the document’s edges, then Straighten to get a flat, deskewed scan — ideal before OCR. Everything runs in your browser.',
    drop: 'Drop a photo or click to browse', dropSub: 'JPG, PNG, WebP · or paste an image (⌘V)',
    hint: 'Drag each corner onto a corner of the document.',
    straighten: 'Straighten', working: 'Processing…', download: 'Download', change: 'New photo', result: 'Result',
  },
  id: {
    intro: 'Luruskan dan potong foto dokumen. Seret empat sudut ke tepi dokumen, lalu Luruskan untuk mendapat pindaian rata dan tegak — ideal sebelum OCR. Semuanya berjalan di browser Anda.',
    drop: 'Letakkan foto atau klik untuk memilih', dropSub: 'JPG, PNG, WebP · atau tempel gambar (⌘V)',
    hint: 'Seret tiap sudut ke sudut dokumen.',
    straighten: 'Luruskan', working: 'Memproses…', download: 'Unduh', change: 'Foto baru', result: 'Hasil',
  },
};

const MAX_DIM = 1600;
type Corners = [Point, Point, Point, Point];

export default function DeskewTool({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [srcDims, setSrcDims] = useState<{ w: number; h: number } | null>(null);
  const [corners, setCorners] = useState<Corners | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<number | null>(null);

  const srcCanvas = () => {
    if (!srcCanvasRef.current) srcCanvasRef.current = document.createElement('canvas');
    return srcCanvasRef.current;
  };

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const loadImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      let w = image.naturalWidth;
      let h = image.naturalHeight;
      const scale = Math.min(1, MAX_DIM / Math.max(w, h));
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const c = srcCanvas();
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(image, 0, 0, w, h);
      setSrcDims({ w, h });
      setCorners([[w * 0.1, h * 0.1], [w * 0.9, h * 0.1], [w * 0.9, h * 0.9], [w * 0.1, h * 0.9]]);
      setResult(null);
    };
    image.src = url;
  };

  const onDrop = (files: File[]) => { const f = files.find(x => x.type.startsWith('image/')); if (f) loadImage(f); };
  usePasteImage(f => loadImage(f));

  // Draw the source preview into the visible img via data URL when dims change.
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    if (!srcDims) return;
    setPreviewUrl(srcCanvas().toDataURL('image/png'));
  }, [srcDims]);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const toDisplay = (p: Point): { x: number; y: number } => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || !srcDims) return { x: 0, y: 0 };
    return { x: (p[0] / srcDims.w) * rect.width, y: (p[1] / srcDims.h) * rect.height };
  };

  const onMove = (e: React.PointerEvent) => {
    if (dragRef.current === null || !srcDims || !corners) return;
    const rect = boxRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1) * srcDims.w;
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1) * srcDims.h;
    setCorners(c => { const next = [...c!] as Corners; next[dragRef.current!] = [x, y]; return next; });
  };

  const straighten = async () => {
    if (!srcDims || !corners) return;
    setBusy(true);
    // Yield so the busy state paints before the heavy loop.
    await new Promise(r => setTimeout(r, 0));
    try {
      const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const outW = Math.round((dist(corners[0], corners[1]) + dist(corners[3], corners[2])) / 2);
      const outH = Math.round((dist(corners[0], corners[3]) + dist(corners[1], corners[2])) / 2);
      const rect: Point[] = [[0, 0], [outW, 0], [outW, outH], [0, outH]];
      const H = computeHomography(rect, corners); // output pixel → source pixel
      const sctx = srcCanvas().getContext('2d')!;
      const src = sctx.getImageData(0, 0, srcDims.w, srcDims.h);
      const out = new ImageData(outW, outH);
      const sw = srcDims.w, sh = srcDims.h;
      for (let v = 0; v < outH; v++) {
        for (let u = 0; u < outW; u++) {
          const [sx, sy] = applyHomography(H, u + 0.5, v + 0.5);
          const ix = sx | 0, iy = sy | 0;
          const o = (v * outW + u) * 4;
          if (ix >= 0 && ix < sw && iy >= 0 && iy < sh) {
            const s = (iy * sw + ix) * 4;
            out.data[o] = src.data[s]; out.data[o + 1] = src.data[s + 1];
            out.data[o + 2] = src.data[s + 2]; out.data[o + 3] = 255;
          } else {
            out.data[o] = 255; out.data[o + 1] = 255; out.data[o + 2] = 255; out.data[o + 3] = 255;
          }
        }
      }
      const rc = document.createElement('canvas');
      rc.width = outW; rc.height = outH;
      rc.getContext('2d')!.putImageData(out, 0, 0);
      const blob = await new Promise<Blob | null>(res => rc.toBlob(res, 'image/png'));
      if (blob) {
        setResult(blob);
        setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      }
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl; a.download = 'deskewed.png'; a.click();
  };

  const backToEdit = () => { setResult(null); setResultUrl(''); };
  const reset = () => { setSrcDims(null); setCorners(null); setResult(null); setResultUrl(''); setPreviewUrl(''); };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!srcDims && (
        <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {srcDims && corners && !result && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.hint}</p>
          <div ref={boxRef} className="relative mx-auto inline-block max-w-full touch-none select-none"
            onPointerMove={onMove} onPointerUp={() => { dragRef.current = null; }}>
            {previewUrl && <img ref={imgRef} src={previewUrl} alt="source" className="block max-h-[70vh] w-auto max-w-full" draggable={false} />}
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <polygon points={corners.map(toDisplay).map(p => `${p.x},${p.y}`).join(' ')}
                fill="rgba(132,204,22,0.15)" stroke="#84cc16" strokeWidth="2" />
            </svg>
            {corners.map((c, i) => {
              const d = toDisplay(c);
              return <div key={i} onPointerDown={e => { dragRef.current = i; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
                className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-black bg-lime-400"
                style={{ left: d.x, top: d.y, touchAction: 'none' }} />;
            })}
          </div>
          <Button onClick={straighten} disabled={busy}>{busy ? t.working : t.straighten}</Button>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
          <img src={resultUrl} alt="result" className="max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>{t.download}</Button>
            <Button variant="secondary" onClick={backToEdit}>{t.straighten}</Button>
            <Button variant="ghost" onClick={reset}>{t.change}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
