import { useEffect, useRef, useState } from 'react';
import { Download, Eraser } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { EditInAnnotatorButton } from '@/components/ui/EditInAnnotatorButton';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { toCHW, toMaskChannel, fromCHW } from '@/tools/image/object-remove.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  expLabel: string;
  expBody: string;
  dropTitle: string;
  dropDesc: string;
  brush: string;
  clearMask: string;
  paintHint: string;
  working: string;
  removeObject: string;
  clear: string;
  stageLoad: string;
  stageRemove: string;
  errNoMask: string;
  errMemory: string;
  errFailed: string;
  result: string;
  altResult: string;
  downloadPng: string;
  consentTitle: string;
  consentIntroA: string;
  consentIntroB: string;
  liDownloadsA: string;
  liDownloadsB: string;
  liDeviceA: string;
  liDeviceStrong: string;
  liDeviceB: string;
  liDeviceC: string;
  liLocal: string;
  downloadContinue: string;
  cancel: string;
}> = {
  en: {
    expLabel: 'Experimental.',
    expBody: 'This uses a large AI inpainting model — it downloads ~200 MB on first use and needs a powerful device. Results vary.',
    dropTitle: 'Drop an image or click to browse',
    dropDesc: 'Paint over an object, then remove it · or paste (⌘V)',
    brush: 'Brush',
    clearMask: 'Clear mask',
    paintHint: 'Paint over the object (or person) you want to remove.',
    working: 'Working…',
    removeObject: 'Remove object',
    clear: 'Clear',
    stageLoad: 'Loading model (first run downloads ~200 MB)…',
    stageRemove: 'Removing… (this can take a while)',
    errNoMask: 'Paint over the object you want to remove first.',
    errMemory: 'Ran out of memory — this model needs a powerful device. Try a smaller image or a desktop browser.',
    errFailed: 'Object removal failed.',
    result: 'Result',
    altResult: 'Object removed',
    downloadPng: 'Download PNG',
    consentTitle: 'Before you continue',
    consentIntroA: 'The Object Remover uses a large AI model (',
    consentIntroB: '). It:',
    liDownloadsA: 'Downloads ',
    liDownloadsB: " the first time (then it's cached).",
    liDeviceA: 'Needs a ',
    liDeviceStrong: 'powerful device',
    liDeviceB: ' — a modern desktop browser and ',
    liDeviceC: '. It may take tens of seconds, and can run out of memory on low-end or mobile devices.',
    liLocal: 'Runs entirely on your device — the image never leaves your browser.',
    downloadContinue: 'Download & continue',
    cancel: 'Cancel',
  },
  id: {
    expLabel: 'Eksperimental.',
    expBody: 'Ini menggunakan model AI inpainting berukuran besar — mengunduh ~200 MB saat pertama kali dipakai dan butuh perangkat yang bertenaga. Hasil bisa bervariasi.',
    dropTitle: 'Jatuhkan gambar atau klik untuk memilih',
    dropDesc: 'Cat area objek, lalu hapus · atau tempel (⌘V)',
    brush: 'Kuas',
    clearMask: 'Bersihkan mask',
    paintHint: 'Cat area objek (atau orang) yang ingin Anda hapus.',
    working: 'Sedang bekerja…',
    removeObject: 'Hapus objek',
    clear: 'Bersihkan',
    stageLoad: 'Memuat model (unduhan pertama ~200 MB)…',
    stageRemove: 'Menghapus… (ini bisa memakan waktu)',
    errNoMask: 'Cat dulu area objek yang ingin Anda hapus.',
    errMemory: 'Kehabisan memori — model ini butuh perangkat yang bertenaga. Coba gambar lebih kecil atau browser desktop.',
    errFailed: 'Gagal menghapus objek.',
    result: 'Hasil',
    altResult: 'Objek dihapus',
    downloadPng: 'Unduh PNG',
    consentTitle: 'Sebelum Anda lanjut',
    consentIntroA: 'Object Remover menggunakan model AI berukuran besar (',
    consentIntroB: '). Tool ini:',
    liDownloadsA: 'Mengunduh ',
    liDownloadsB: ' saat pertama kali (lalu disimpan di cache).',
    liDeviceA: 'Butuh ',
    liDeviceStrong: 'perangkat bertenaga',
    liDeviceB: ' — browser desktop modern dan ',
    liDeviceC: '. Bisa memakan puluhan detik, dan dapat kehabisan memori pada perangkat kelas bawah atau mobile.',
    liLocal: 'Berjalan sepenuhnya di perangkat Anda — gambar tidak pernah meninggalkan browser Anda.',
    downloadContinue: 'Unduh & lanjutkan',
    cancel: 'Batal',
  },
};

// This LaMa export has a fixed 512×512 input; we resize in and scale the result
// back out (the stretch cancels, so the removed region stays in place).
const MODEL_SIZE = 512;

export default function ObjectRemove({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const viewRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [brush, setBrush] = useState(28);
  const [hasMask, setHasMask] = useState(false);
  const [consented, setConsented] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const scaleX = () => {
    const c = viewRef.current;
    return c ? c.width / c.getBoundingClientRect().width : 1;
  };

  const redraw = () => {
    const view = viewRef.current;
    const bmp = bitmapRef.current;
    const mask = maskRef.current;
    if (!view || !bmp || !mask) return;
    const ctx = view.getContext('2d')!;
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(bmp, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.5; // translucent red mask overlay
    ctx.drawImage(mask, 0, 0);
    ctx.restore();
  };

  const onDrop = async (files: File[]) => {
    const image = files.find(f => f.type.startsWith('image/'));
    if (!image) return;
    setFile(image);
    setResult(null);
    setError('');
    setReady(false);
    setHasMask(false);
    const bmp = await createImageBitmap(image);
    bitmapRef.current = bmp;
    const mask = document.createElement('canvas');
    mask.width = bmp.width;
    mask.height = bmp.height;
    maskRef.current = mask;
    setDims({ w: bmp.width, h: bmp.height });
    setReady(true);
  };

  usePasteImage(f => onDrop([f]));

  useEffect(() => { if (ready) redraw(); }, [ready]);

  const pointer = (e: React.PointerEvent) => {
    const c = viewRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (c.width / rect.width), y: (e.clientY - rect.top) * (c.height / rect.height) };
  };

  const paintTo = (x: number, y: number) => {
    const mask = maskRef.current;
    if (!mask) return;
    const mctx = mask.getContext('2d')!;
    mctx.fillStyle = 'rgba(255,0,0,1)';
    mctx.strokeStyle = 'rgba(255,0,0,1)';
    const r = Math.max(2, brush * scaleX());
    mctx.lineWidth = r * 2;
    mctx.lineCap = 'round';
    const last = lastRef.current;
    if (last) {
      mctx.beginPath();
      mctx.moveTo(last.x, last.y);
      mctx.lineTo(x, y);
      mctx.stroke();
    }
    mctx.beginPath();
    mctx.arc(x, y, r, 0, Math.PI * 2);
    mctx.fill();
    lastRef.current = { x, y };
    setHasMask(true);
    redraw();
  };

  const onDown = (e: React.PointerEvent) => {
    if (!ready) return;
    drawingRef.current = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    lastRef.current = null;
    const p = pointer(e);
    paintTo(p.x, p.y);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const p = pointer(e);
    paintTo(p.x, p.y);
  };
  const onUp = () => { drawingRef.current = false; lastRef.current = null; };

  const clearMask = () => {
    const mask = maskRef.current;
    if (mask) mask.getContext('2d')!.clearRect(0, 0, mask.width, mask.height);
    setHasMask(false);
    redraw();
  };

  const runInference = async () => {
    const bmp = bitmapRef.current;
    const mask = maskRef.current;
    if (!bmp || !mask || !dims) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { w: W, h: H } = dims;
      const ww = MODEL_SIZE;
      const wh = MODEL_SIZE;

      // Image + mask at the model's working resolution.
      const draw = (src: CanvasImageSource) => {
        const c = document.createElement('canvas');
        c.width = ww;
        c.height = wh;
        c.getContext('2d')!.drawImage(src, 0, 0, ww, wh);
        return c.getContext('2d')!.getImageData(0, 0, ww, wh).data;
      };
      const imageCHW = toCHW(draw(bmp), ww, wh);
      const maskCh = toMaskChannel(draw(mask), ww, wh);

      setStage(t.stageLoad);
      const ort = await import('onnxruntime-web');
      ort.env.wasm.wasmPaths = new URL('/models/ort/', location.origin).href;
      ort.env.wasm.numThreads = 1;
      if (!sessionRef.current) {
        sessionRef.current = await ort.InferenceSession.create(
          new URL('/models/lama/lama_fp32.onnx', location.origin).href,
          { executionProviders: ['wasm'] }
        );
      }

      setStage(t.stageRemove);
      const feeds = {
        image: new ort.Tensor('float32', imageCHW, [1, 3, wh, ww]),
        mask: new ort.Tensor('float32', maskCh, [1, 1, wh, ww]),
      };
      const out = await sessionRef.current.run(feeds);
      const data = out.output.data as Float32Array;
      const inpaintedRGBA = fromCHW(data, ww, wh);

      // Composite: full-res original, with the masked region replaced by the
      // (upscaled) inpainted result.
      const inpaint = document.createElement('canvas');
      inpaint.width = ww;
      inpaint.height = wh;
      inpaint.getContext('2d')!.putImageData(new ImageData(inpaintedRGBA, ww, wh), 0, 0);

      const layer = document.createElement('canvas');
      layer.width = W;
      layer.height = H;
      const lctx = layer.getContext('2d')!;
      lctx.drawImage(inpaint, 0, 0, W, H);
      lctx.globalCompositeOperation = 'destination-in';
      lctx.drawImage(mask, 0, 0);

      const resCanvas = document.createElement('canvas');
      resCanvas.width = W;
      resCanvas.height = H;
      const rctx = resCanvas.getContext('2d')!;
      rctx.drawImage(bmp, 0, 0);
      rctx.drawImage(layer, 0, 0);

      const blob = await new Promise<Blob>((res, rej) =>
        resCanvas.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/png')
      );
      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(
        e instanceof Error && /memory|alloc/i.test(e.message)
          ? t.errMemory
          : e instanceof Error
            ? e.message
            : t.errFailed
      );
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const onRemoveClick = () => {
    if (!hasMask) {
      setError(t.errNoMask);
      return;
    }
    if (!consented) setShowConsent(true);
    else runInference();
  };

  const download = () => {
    if (!result || !file) return;
    downloadService.download(result, file.name.replace(/\.[^.]+$/, '') + '-removed.png');
  };

  return (
    <div className="space-y-4">
      <Alert variant="error">
        <strong>{t.expLabel}</strong> {t.expBody}
      </Alert>

      {!file && (
        <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.dropTitle}</p>
            <p className="text-sm text-muted-foreground">{t.dropDesc}</p>
          </div>
        </Dropzone>
      )}

      {file && ready && dims && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.brush}</span>
              <input type="range" min={8} max={80} value={brush} onChange={e => setBrush(Number(e.target.value))} className="w-32 accent-accent" />
            </label>
            <Button variant="ghost" onClick={clearMask} disabled={!hasMask}>{t.clearMask}</Button>
          </div>

          <p className="text-xs text-muted-foreground">{t.paintHint}</p>

          <div className="relative inline-block max-w-full overflow-auto border-2 border-border bg-muted">
            <canvas
              ref={viewRef}
              width={dims.w}
              height={dims.h}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              className="block h-auto w-auto min-w-[70vw] max-w-full touch-none"
              style={{ cursor: 'crosshair' }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onRemoveClick} disabled={busy || !hasMask}>
              <Eraser className="h-4 w-4" />
              {busy ? t.working : t.removeObject}
            </Button>
            <Button variant="ghost" onClick={() => { setFile(null); setReady(false); setResult(null); setError(''); }}>{t.clear}</Button>
          </div>
        </>
      )}

      {busy && <p className="text-sm text-muted-foreground">{stage || t.working}</p>}
      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          <img src={resultUrl} alt={t.altResult} className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="h-4 w-4" />
              {t.downloadPng}
            </Button>
            <CopyImageButton blob={result} />
          <EditInAnnotatorButton blob={result} filename={(file?.name ?? 'image').replace(/\.[^.]+$/, '') + '-removed.png'} />
          </div>
        </div>
      )}

      {showConsent && (
        <Modal title={t.consentTitle} onClose={() => setShowConsent(false)}>
          <div className="space-y-3 text-sm">
            <p>{t.consentIntroA}<strong>LaMa</strong>{t.consentIntroB}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t.liDownloadsA}<strong>~200 MB</strong>{t.liDownloadsB}</li>
              <li>{t.liDeviceA}<strong>{t.liDeviceStrong}</strong>{t.liDeviceB}<strong>≥ 4 GB RAM</strong>{t.liDeviceC}</li>
              <li>{t.liLocal}</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => { setConsented(true); setShowConsent(false); runInference(); }}>
                {t.downloadContinue}
              </Button>
              <Button variant="ghost" onClick={() => setShowConsent(false)}>{t.cancel}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
