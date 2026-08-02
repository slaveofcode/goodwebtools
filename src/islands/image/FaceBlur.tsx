import { useEffect, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { EditInAnnotatorButton } from '@/components/ui/EditInAnnotatorButton';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { expandBox, type Box } from '@/tools/image/face-blur.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

type Effect = 'blur' | 'pixelate' | 'solid';

const EFFECTS: { key: Effect; label: string }[] = [
  { key: 'blur', label: 'Blur' },
  { key: 'pixelate', label: 'Pixelate' },
  { key: 'solid', label: 'Solid' },
];

const TR: Record<Lang, {
  dropTitle: string; dropDesc: string; effect: string; effects: Record<Effect, string>;
  privacy: ReactNode; loadingDetector: string; detecting: string; working: string;
  errProcess: string; noFaces: string; result: string; facesHidden: (n: number) => string;
  altBlurred: string; downloadPng: string;
}> = {
  en: {
    dropTitle: 'Drop an image or click to browse',
    dropDesc: 'Detects and hides faces with on-device AI · or paste (⌘V)',
    effect: 'Effect',
    effects: { blur: 'Blur', pixelate: 'Pixelate', solid: 'Solid' },
    privacy: <>Runs entirely in your browser — the image never leaves your device. Detection is automatic; for privacy-critical images, prefer <strong>Solid</strong> (blur/pixelate can be partly reversed). The first run downloads a small model, then it's cached.</>,
    loadingDetector: 'Loading face detector…',
    detecting: 'Detecting faces…',
    working: 'Working…',
    errProcess: 'Could not process this image.',
    noFaces: 'No faces detected in this image.',
    result: 'Result',
    facesHidden: (n) => `${n} face${n === 1 ? '' : 's'} hidden`,
    altBlurred: 'Faces blurred',
    downloadPng: 'Download PNG',
  },
  id: {
    dropTitle: 'Letakkan gambar atau klik untuk memilih',
    dropDesc: 'Mendeteksi dan menyembunyikan wajah dengan AI di perangkat · atau tempel (⌘V)',
    effect: 'Efek',
    effects: { blur: 'Blur', pixelate: 'Piksel', solid: 'Blok' },
    privacy: <>Berjalan sepenuhnya di browser Anda — gambar tidak pernah meninggalkan perangkat Anda. Deteksi berjalan otomatis; untuk gambar yang sangat sensitif, pilih <strong>Blok</strong> (blur/piksel bisa sebagian dipulihkan). Penggunaan pertama mengunduh model kecil, lalu di-cache.</>,
    loadingDetector: 'Memuat pendeteksi wajah…',
    detecting: 'Mendeteksi wajah…',
    working: 'Memproses…',
    errProcess: 'Tidak dapat memproses gambar ini.',
    noFaces: 'Tidak ada wajah terdeteksi pada gambar ini.',
    result: 'Hasil',
    facesHidden: (n) => `${n} wajah disembunyikan`,
    altBlurred: 'Wajah diburamkan',
    downloadPng: 'Unduh PNG',
  },
};

// Cache the detector across runs so the model loads once.
let detectorPromise: Promise<{ detect: (img: ImageBitmap) => { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number } }[] } }> | null = null;

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(new URL('/models/mediapipe/wasm', location.origin).href);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: new URL('/models/mediapipe/blaze_face_short_range.tflite', location.origin).href },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.4,
      });
    })();
  }
  return detectorPromise;
}

/** Obscure a box on the canvas with the chosen effect, clipped to an ellipse. */
function obscure(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, box: Box, effect: Effect) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
  ctx.clip();

  if (effect === 'solid') {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(box.x, box.y, box.w, box.h);
  } else if (effect === 'pixelate') {
    const block = Math.max(4, Math.round(Math.min(box.w, box.h) / 10));
    const sw = Math.max(1, Math.round(box.w / block));
    const sh = Math.max(1, Math.round(box.h / block));
    const tmp = document.createElement('canvas');
    tmp.width = sw;
    tmp.height = sh;
    const tctx = tmp.getContext('2d')!;
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(bmp, box.x, box.y, box.w, box.h, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, sw, sh, box.x, box.y, box.w, box.h);
    ctx.imageSmoothingEnabled = true;
  } else {
    const radius = Math.max(8, Math.round(Math.min(box.w, box.h) / 3));
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(bmp, 0, 0);
    ctx.filter = 'none';
  }
  ctx.restore();
}

export default function FaceBlur({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [effect, setEffect] = useState<Effect>('blur');
  const [srcName, setSrcName] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [lastFile, setLastFile] = useState<File | null>(null);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const process = async (file: File, fx: Effect) => {
    setSrcName(file.name);
    setResult(null);
    setFaceCount(null);
    setError('');
    setBusy(true);
    try {
      setStage(t.loadingDetector);
      const detector = await getDetector();
      const bmp = await createImageBitmap(file);
      setStage(t.detecting);
      const { detections } = detector.detect(bmp);

      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);

      for (const d of detections) {
        const b = d.boundingBox;
        if (!b) continue;
        const box = expandBox(
          { x: b.originX, y: b.originY, w: b.width, h: b.height },
          0.35,
          bmp.width,
          bmp.height
        );
        obscure(ctx, bmp, box, fx);
      }
      bmp.close?.();
      setFaceCount(detections.length);

      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/png')
      );
      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errProcess);
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const onDrop = (files: File[]) => {
    const file = files.find(f => f.type.startsWith('image/'));
    if (!file) return;
    setLastFile(file);
    process(file, effect);
  };

  usePasteImage(f => onDrop([f]));

  const changeEffect = (fx: Effect) => {
    setEffect(fx);
    if (lastFile) process(lastFile, fx);
  };

  const download = () => {
    if (!result) return;
    downloadService.download(result, (srcName.replace(/\.[^.]+$/, '') || 'image') + '-blurred.png');
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropTitle}</p>
          <p className="text-sm text-muted-foreground">
            {t.dropDesc}
          </p>
        </div>
      </Dropzone>

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.effect}</span>
        <div className="flex flex-wrap gap-2">
          {EFFECTS.map(e => (
            <Button
              key={e.key}
              variant={effect === e.key ? 'primary' : 'secondary'}
              aria-pressed={effect === e.key}
              onClick={() => changeEffect(e.key)}
              disabled={busy}
            >
              {t.effects[e.key]}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.privacy}
      </p>

      {busy && <p className="text-sm text-muted-foreground">{stage || t.working}</p>}
      {error && <Alert variant="error">{error}</Alert>}

      {faceCount === 0 && !busy && !error && (
        <Alert variant="error">{t.noFaces}</Alert>
      )}

      {result && resultUrl && !busy && faceCount !== null && faceCount > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span>{t.facesHidden(faceCount)}</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          <img src={resultUrl} alt={t.altBlurred} className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="h-4 w-4" />
              {t.downloadPng}
            </Button>
            <CopyImageButton blob={result} />
          <EditInAnnotatorButton blob={result} filename={(srcName.replace(/\.[^.]+$/, '') || 'image') + '-blurred.png'} />
          </div>
        </div>
      )}
    </div>
  );
}
