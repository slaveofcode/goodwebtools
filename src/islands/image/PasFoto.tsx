import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Upload, Crosshair } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import PasFotoCamera from './PasFotoCamera';
import { alignTransform, type FaceBox } from '@/tools/image/foto-align.lib';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { usePasteImage } from '@/hooks/usePasteImage';
import { encodeCanvas } from '@/tools/image/canvas.lib';
import {
  PHOTO_SIZES,
  SHEETS,
  cmToPt,
  photoPx,
  sheetLayout,
  headGuideBox,
  type PhotoSize,
  type Sheet,
} from '@/tools/image/pas-foto.lib';
import type { Lang } from '@/i18n/config';

const GAP_CM = 0.2;
const MARGIN_CM = 0.3;
// Framing-guide geometry in a 0–100 viewBox (drawn only on the preview).
const GUIDE = headGuideBox(100, 100);
const BG_PRESETS = [
  { color: '#e02424', label: 'Merah' },
  { color: '#1e50e0', label: 'Biru' },
  { color: '#ffffff', label: 'Putih' },
];

const TR: Record<Lang, {
  intro: string;
  dropTitle: string;
  dropSub: string;
  removeBg: string;
  background: string;
  size: string;
  sheet: string;
  zoom: string;
  position: string;
  generate: string;
  generating: string;
  preparing: string;
  downloadingModel: string;
  removingBg: string;
  removeFailed: string;
  genFailed: string;
  copies: (n: number) => string;
  reset: string;
  guide: string;
  guideHint: string;
  tabUpload: string;
  tabCamera: string;
  recenter: string;
  aligning: string;
  alignedHint: string;
}> = {
  en: {
    intro: 'Make a print-ready ID photo (pas foto): remove the background, pick a color and size, and download a PDF that tiles copies onto a photo sheet — ready to print. Everything runs in your browser.',
    dropTitle: 'Drop a portrait photo or click to browse',
    dropSub: 'A clear, front-facing photo works best · or paste (⌘V)',
    removeBg: 'Remove background',
    background: 'Background color',
    size: 'Photo size',
    sheet: 'Print sheet',
    zoom: 'Zoom',
    position: 'Vertical position',
    generate: 'Generate print PDF',
    generating: 'Generating…',
    preparing: 'Preparing…',
    downloadingModel: 'Downloading model…',
    removingBg: 'Removing background…',
    removeFailed: 'Background removal failed. Try another photo or turn it off.',
    genFailed: 'Could not generate the PDF.',
    copies: (n) => `${n} copies per sheet`,
    reset: 'Clear',
    guide: 'Show framing guide',
    guideHint: 'Align the crown and chin to the dashed lines for a passport-style crop.',
    tabUpload: 'Upload a photo',
    tabCamera: 'Take a photo',
    recenter: 'Auto-align head',
    aligning: 'Aligning…',
    alignedHint: 'Head aligned automatically — fine-tune with the sliders if needed.',
  },
  id: {
    intro: 'Buat pas foto siap cetak: hapus latar belakang, pilih warna dan ukuran, lalu unduh PDF berisi banyak salinan dalam satu lembar foto — siap dicetak. Semuanya berjalan di browser Anda.',
    dropTitle: 'Letakkan foto potret atau klik untuk memilih',
    dropSub: 'Foto menghadap depan yang jelas paling bagus · atau tempel (⌘V)',
    removeBg: 'Hapus latar belakang',
    background: 'Warna latar',
    size: 'Ukuran foto',
    sheet: 'Lembar cetak',
    zoom: 'Perbesar',
    position: 'Posisi vertikal',
    generate: 'Buat PDF cetak',
    generating: 'Membuat…',
    preparing: 'Menyiapkan…',
    downloadingModel: 'Mengunduh model…',
    removingBg: 'Menghapus latar belakang…',
    removeFailed: 'Gagal menghapus latar belakang. Coba foto lain atau matikan opsi ini.',
    genFailed: 'Tidak dapat membuat PDF.',
    copies: (n) => `${n} salinan per lembar`,
    reset: 'Bersihkan',
    guide: 'Tampilkan panduan bingkai',
    guideHint: 'Sejajarkan puncak kepala dan dagu ke garis putus-putus untuk hasil gaya paspor.',
    tabUpload: 'Unggah foto',
    tabCamera: 'Ambil foto',
    recenter: 'Sejajarkan kepala otomatis',
    aligning: 'Menyejajarkan…',
    alignedHint: 'Kepala disejajarkan otomatis — sesuaikan dengan slider bila perlu.',
  },
};

export default function PasFoto({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [srcFile, setSrcFile] = useState<File | null>(null);
  const [subjectUrl, setSubjectUrl] = useState('');
  const [removeBg, setRemoveBg] = useState(true);
  const [bgColor, setBgColor] = useState('#e02424');
  const [size, setSize] = useState<PhotoSize>(PHOTO_SIZES[1]); // 3x4
  const [sheet, setSheet] = useState<Sheet>(SHEETS[0]); // 4R
  const [zoom, setZoom] = useState(1);
  const [offsetY, setOffsetY] = useState(0); // -0.5 .. 0.5 of frame height
  const [showGuide, setShowGuide] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [percent, setPercent] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Blob | null>(null);

  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [aligning, setAligning] = useState(false);
  const [aligned, setAligned] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgReady, setImgReady] = useState(0);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  // Revoke the subject object URL when it changes/unmounts.
  useEffect(() => () => { if (subjectUrl) URL.revokeObjectURL(subjectUrl); }, [subjectUrl]);

  const layout = useMemo(
    () => sheetLayout(size.w, size.h, sheet.w, sheet.h, GAP_CM, MARGIN_CM),
    [size, sheet],
  );

  const setSubject = (blob: Blob) => {
    setSubjectUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  };

  // Prepare the subject bitmap: remove background (or use the original).
  const prepare = async (file: File, strip: boolean) => {
    setError('');
    setResult(null);
    if (!strip) {
      setSubject(file);
      return;
    }
    setBusy(true);
    setPercent(0);
    setStage(t.preparing);
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(file, {
        publicPath: new URL('/models/imgly/', location.origin).href,
        output: { format: 'image/png' },
        progress: (key, current, total) => {
          setPercent(total > 0 ? Math.round((current / total) * 100) : 0);
          setStage(key.startsWith('fetch') ? t.downloadingModel : t.removingBg);
        },
      });
      setSubject(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.removeFailed);
      setSubject(file); // fall back to the original so the user isn't stuck
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  /**
   * Detect the face in a source image and set zoom/offset so the head lands on
   * the passport guide. Best-effort: if detection fails the manual sliders are
   * untouched and the user carries on as before.
   */
  const autoAlign = async (file: File) => {
    setAligning(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(new URL('/models/mediapipe/wasm', location.origin).href);
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: new URL('/models/mediapipe/blaze_face_short_range.tflite', location.origin).href },
          runningMode: 'IMAGE',
          minDetectionConfidence: 0.4,
        });
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
        const box = detector.detect(canvas).detections?.[0]?.boundingBox;
        detector.close();
        if (box) {
          const face: FaceBox = { x: box.originX, y: box.originY, w: box.width, h: box.height };
          const s = sizeRef.current;
          const { zoom: z, offsetY: oy } = alignTransform(face, bitmap.width, bitmap.height, s.w * 100, s.h * 100);
          setZoom(z);
          setOffsetY(oy);
          setAligned(true);
        }
      } finally {
        bitmap.close?.();
      }
    } catch {
      // No detector / no face — keep the manual controls as they are.
    } finally {
      setAligning(false);
    }
  };

  const onDrop = (files: File[]) => {
    const file = files.find(f => f.type.startsWith('image/'));
    if (!file) return;
    setAligned(false);
    setSrcFile(file);
    prepare(file, removeBg);
    void autoAlign(file);
  };

  const onCameraCapture = (file: File) => {
    setMode('upload');
    onDrop([file]);
  };

  usePasteImage(f => onDrop([f]));

  // Toggle background removal → re-prepare from the original file.
  const toggleRemoveBg = () => {
    const next = !removeBg;
    setRemoveBg(next);
    if (srcFile) prepare(srcFile, next);
  };

  // Load the subject into an <img> for canvas compositing.
  useEffect(() => {
    if (!subjectUrl) { imgRef.current = null; return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgReady(v => v + 1); };
    img.src = subjectUrl;
  }, [subjectUrl]);

  /** Composite the subject onto a colored frame of the given pixel size. */
  const compose = (canvas: HTMLCanvasElement, W: number, H: number) => {
    const img = imgRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);
    if (!img) return;
    const cover = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const s = cover * zoom;
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const x = (W - dw) / 2;
    const y = (H - dh) / 2 + offsetY * H;
    ctx.drawImage(img, x, y, dw, dh);
  };

  // Live preview, drawn at a downscaled resolution for speed.
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ratio = size.w / size.h;
    const H = 400;
    compose(canvas, Math.round(H * ratio), H);
  }, [imgReady, bgColor, size, zoom, offsetY]);

  const generate = async () => {
    if (!srcFile || !imgRef.current) return;
    setGenerating(true);
    setError('');
    try {
      const { w: Wpx, h: Hpx } = photoPx(size.w, size.h);
      const canvas = document.createElement('canvas');
      compose(canvas, Wpx, Hpx);
      const jpeg = await encodeCanvas(canvas, 'image/jpeg', 0.95);
      const bytes = new Uint8Array(await jpeg.arrayBuffer());

      const { PDFDocument, rgb } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([cmToPt(sheet.w), cmToPt(sheet.h)]);
      const embedded = await pdf.embedJpg(bytes);
      const wPt = cmToPt(size.w);
      const hPt = cmToPt(size.h);
      const sheetHPt = cmToPt(sheet.h);
      for (const pos of layout.positions) {
        const x = cmToPt(pos.x);
        // Convert top-left (cm) to PDF bottom-left origin.
        const y = sheetHPt - cmToPt(pos.y) - hPt;
        page.drawImage(embedded, { x, y, width: wPt, height: hPt });
        page.drawRectangle({
          x, y, width: wPt, height: hPt,
          borderColor: rgb(0.8, 0.8, 0.8),
          borderWidth: 0.5,
        });
      }
      setResult(new Blob([await pdf.save()], { type: 'application/pdf' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.genFailed);
    } finally {
      setGenerating(false);
    }
  };

  const clear = () => {
    setSrcFile(null);
    setSubjectUrl('');
    imgRef.current = null;
    setResult(null);
    setError('');
  };

  const segClass = (active: boolean) =>
    `border-2 px-3 py-1 text-sm font-medium transition-all ${
      active ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'
    }`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap gap-2">
        <Button variant={mode === 'upload' ? 'primary' : 'secondary'} onClick={() => setMode('upload')}>
          <Upload className="h-4 w-4" /> {t.tabUpload}
        </Button>
        <Button variant={mode === 'camera' ? 'primary' : 'secondary'} onClick={() => setMode('camera')}>
          <Camera className="h-4 w-4" /> {t.tabCamera}
        </Button>
      </div>

      {mode === 'camera' ? (
        <PasFotoCamera
          photoW={size.w * 100}
          photoH={size.h * 100}
          lang={lang}
          onCapture={onCameraCapture}
          onCancel={() => setMode('upload')}
        />
      ) : (
        <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.dropTitle}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {busy && <ProgressBar percent={percent} label={stage} />}

      {srcFile && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          {/* Preview */}
          <div className="space-y-2">
            <div className="flex justify-center border-2 border-border bg-muted p-3">
              <div className="relative inline-block border border-border">
                <canvas ref={previewRef} className="block h-auto max-h-[60vh] w-auto" />
                {showGuide && (
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    {/* Dark halo behind, light line on top → visible on any background. */}
                    <g fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={1.4}>
                      <line x1={0} y1={GUIDE.crownY} x2={100} y2={GUIDE.crownY} />
                      <line x1={0} y1={GUIDE.chinY} x2={100} y2={GUIDE.chinY} />
                      <ellipse cx={GUIDE.cx} cy={GUIDE.cy} rx={GUIDE.rx} ry={GUIDE.ry} />
                    </g>
                    <g fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={0.5} strokeDasharray="2 2">
                      <line x1={0} y1={GUIDE.crownY} x2={100} y2={GUIDE.crownY} />
                      <line x1={0} y1={GUIDE.chinY} x2={100} y2={GUIDE.chinY} />
                      <ellipse cx={GUIDE.cx} cy={GUIDE.cy} rx={GUIDE.rx} ry={GUIDE.ry} />
                    </g>
                  </svg>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={showGuide} onChange={e => setShowGuide(e.target.checked)} className="h-4 w-4 accent-accent" />
              {t.guide}
            </label>
            {showGuide && <p className="text-xs text-muted-foreground">{t.guideHint}</p>}
            <label className="block space-y-1 text-sm">
              <span className="flex justify-between font-semibold"><span>{t.zoom}</span><span>{zoom.toFixed(2)}×</span></span>
              <input type="range" min={0.5} max={2} step={0.01} value={zoom}
                onChange={e => setZoom(Number(e.target.value))} className="w-full accent-accent" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="block font-semibold">{t.position}</span>
              <input type="range" min={-0.5} max={0.5} step={0.01} value={offsetY}
                onChange={e => setOffsetY(Number(e.target.value))} className="w-full accent-accent" />
            </label>
            <div className="space-y-1">
              <Button variant="secondary" onClick={() => srcFile && void autoAlign(srcFile)} disabled={!srcFile || aligning}>
                <Crosshair className="h-4 w-4" /> {aligning ? t.aligning : t.recenter}
              </Button>
              {aligned && !aligning && <p className="text-xs text-muted-foreground">{t.alignedHint}</p>}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={removeBg} onChange={toggleRemoveBg} className="h-4 w-4 accent-accent" />
              {t.removeBg}
            </label>

            <div className="space-y-1 text-sm">
              <span className="block font-semibold">{t.background}</span>
              <div className="flex flex-wrap items-center gap-2">
                {BG_PRESETS.map(p => (
                  <button key={p.color} onClick={() => setBgColor(p.color)} aria-pressed={bgColor === p.color}
                    title={p.label}
                    className={`h-9 w-9 border-2 ${bgColor === p.color ? 'border-accent shadow-brutal' : 'border-border'}`}
                    style={{ background: p.color }} />
                ))}
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer border-2 border-border bg-muted" />
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <span className="block font-semibold">{t.size}</span>
              <div className="flex flex-wrap gap-1">
                {PHOTO_SIZES.map(s => (
                  <button key={s.id} onClick={() => setSize(s)} aria-pressed={size.id === s.id} className={segClass(size.id === s.id)}>
                    {s.w}×{s.h} cm
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <span className="block font-semibold">{t.sheet}</span>
              <div className="flex flex-wrap gap-1">
                {SHEETS.map(s => (
                  <button key={s.id} onClick={() => setSheet(s)} aria-pressed={sheet.id === s.id} className={segClass(sheet.id === s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t.copies(layout.count)}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={generate} disabled={generating || busy || layout.count === 0}>
                {generating ? t.generating : t.generate}
              </Button>
              <Button variant="ghost" onClick={clear} disabled={generating || busy}>{t.reset}</Button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <ResultActions blob={result} filename={`pas-foto-${size.id}-${sheet.id}.pdf`} />
          <PdfPreview source={result} />
        </div>
      )}
    </div>
  );
}
