import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { EditInAnnotatorButton } from '@/components/ui/EditInAnnotatorButton';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  dropTitle: string;
  dropDesc: string;
  scale: string;
  helper: string;
  tooLarge: (s: number, mp: string, side: number) => string;
  errFailed: string;
  stagePass: (s: number, i: number, n: number) => string;
  stageSingle: (s: number) => string;
  working: string;
  result: string;
  altResult: string;
  downloadPng: string;
}> = {
  en: {
    dropTitle: 'Drop an image or click to browse',
    dropDesc: 'Enlarges an image with an on-device AI model (ESRGAN) · or paste (⌘V)',
    scale: 'Scale',
    helper: "Runs entirely in your browser — the image never leaves your device. Best on smaller images (icons, logos, old photos). 2–4× use native models; 8× runs two passes (4×→2×). Higher factors need a smaller input so the result fits in memory — the max input shrinks as the scale grows. The models download once (~1 MB each), then they're cached.",
    tooLarge: (s, mp, side) => `Image is too large to upscale ${s}× in the browser (max ~${mp} MP, about ${side}×${side}). Resize it first.`,
    errFailed: 'Upscaling failed.',
    stagePass: (s, i, n) => `Upscaling ${s}× (pass ${i}/${n})…`,
    stageSingle: (s) => `Upscaling ${s}×…`,
    working: 'Working…',
    result: 'Result',
    altResult: 'Upscaled',
    downloadPng: 'Download PNG',
  },
  id: {
    dropTitle: 'Jatuhkan gambar atau klik untuk memilih',
    dropDesc: 'Memperbesar gambar dengan model AI di perangkat (ESRGAN) · atau tempel (⌘V)',
    scale: 'Skala',
    helper: 'Berjalan sepenuhnya di browser Anda — gambar tidak pernah meninggalkan perangkat Anda. Paling baik pada gambar kecil (ikon, logo, foto lama). 2–4× memakai model native; 8× menjalankan dua tahap (4×→2×). Faktor lebih tinggi butuh input lebih kecil agar hasilnya muat di memori — batas input mengecil seiring skala membesar. Model diunduh sekali (~1 MB masing-masing), lalu disimpan di cache.',
    tooLarge: (s, mp, side) => `Gambar terlalu besar untuk diperbesar ${s}× di browser (maks ~${mp} MP, sekitar ${side}×${side}). Ubah ukurannya dulu.`,
    errFailed: 'Gagal memperbesar.',
    stagePass: (s, i, n) => `Memperbesar ${s}× (tahap ${i}/${n})…`,
    stageSingle: (s) => `Memperbesar ${s}×…`,
    working: 'Sedang bekerja…',
    result: 'Hasil',
    altResult: 'Diperbesar',
    downloadPng: 'Unduh PNG',
  },
};

type BaseScale = 2 | 3 | 4;
type Scale = 2 | 3 | 4 | 8;

// ESRGAN-slim's reliable native models are 2×/3×/4×; 8× runs two passes (4×→2×)
// — the package's "8x" weights actually upscale ~4×, so we chain instead.
const STEPS: Record<Scale, BaseScale[]> = {
  2: [2],
  3: [3],
  4: [4],
  8: [4, 2],
};

// Cap the *output* size (memory + canvas limits), which sets how big an input a
// given scale allows: bigger scales need smaller inputs.
const MAX_OUTPUT_PIXELS = 20_000_000; // ~20 MP (matches the old 1.2 MP @ 4×)
const maxInputFor = (scale: Scale) => Math.floor(MAX_OUTPUT_PIXELS / (scale * scale));

async function loadModel(scale: BaseScale) {
  const [{ default: Upscaler }, mod] = await Promise.all([
    import('upscaler'),
    scale === 2
      ? import('@upscalerjs/esrgan-slim/2x')
      : scale === 3
        ? import('@upscalerjs/esrgan-slim/3x')
        : import('@upscalerjs/esrgan-slim/4x'),
  ]);
  const model = {
    ...(mod.default as object),
    // Self-hosted weights (R2 in prod, public/ in dev) instead of the CDN.
    path: new URL(`/models/esrgan-slim/x${scale}/model.json`, location.origin).href,
  };
  return new Upscaler({ model });
}

export default function ImageUpscale({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [scale, setScale] = useState<Scale>(4);
  const [file, setFile] = useState<File | null>(null);
  const [srcDims, setSrcDims] = useState<{ w: number; h: number } | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [outDims, setOutDims] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const run = async (target: File, s: Scale) => {
    setResult(null);
    setOutDims(null);
    setError('');
    // Measure input size and guard against outputs too big for the browser.
    const bmp = await createImageBitmap(target);
    setSrcDims({ w: bmp.width, h: bmp.height });
    bmp.close?.();
    const limit = maxInputFor(s);
    if (bmp.width * bmp.height > limit) {
      const side = Math.round(Math.sqrt(limit));
      setError(t.tooLarge(s, (limit / 1_000_000).toFixed(1), side));
      return;
    }

    setBusy(true);
    setPercent(0);
    const steps = STEPS[s];
    try {
      // Chain each pass, feeding one pass's output into the next.
      let src = URL.createObjectURL(target);
      let revokeSrc = true;
      let dataUrl = '';
      for (let i = 0; i < steps.length; i++) {
        setStage(steps.length > 1 ? t.stagePass(s, i + 1, steps.length) : t.stageSingle(s));
        const upscaler = await loadModel(steps[i]);
        dataUrl = await upscaler.upscale(src, {
          output: 'base64',
          patchSize: 64,
          padding: 4,
          progress: (rate: number) => setPercent(Math.round(((i + rate) / steps.length) * 100)),
        });
        upscaler.dispose?.();
        if (revokeSrc) URL.revokeObjectURL(src);
        src = dataUrl; // next pass reads the previous result (a data URL)
        revokeSrc = false;
      }
      const blob = await (await fetch(dataUrl)).blob();
      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      const out = await createImageBitmap(blob);
      setOutDims({ w: out.width, h: out.height });
      out.close?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errFailed);
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const onDrop = (files: File[]) => {
    const image = files.find(f => f.type.startsWith('image/'));
    if (!image) return;
    setFile(image);
    run(image, scale);
  };

  usePasteImage(f => onDrop([f]));

  const changeScale = (s: Scale) => {
    setScale(s);
    if (file) run(file, s);
  };

  const download = () => {
    if (!result || !file) return;
    downloadService.download(result, file.name.replace(/\.[^.]+$/, '') + `-${scale}x.png`);
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
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.scale}</span>
        <div className="flex flex-wrap gap-2">
          {([2, 3, 4, 8] as Scale[]).map(s => (
            <Button key={s} variant={scale === s ? 'primary' : 'secondary'} aria-pressed={scale === s} onClick={() => changeScale(s)} disabled={busy}>
              {s}×
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.helper}
      </p>

      {busy && <ProgressBar percent={percent} label={stage || t.working} />}
      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            {srcDims && outDims && (
              <span>{srcDims.w}×{srcDims.h} → <span className="font-bold">{outDims.w}×{outDims.h}</span></span>
            )}
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          <img src={resultUrl} alt={t.altResult} className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="h-4 w-4" />
              {t.downloadPng}
            </Button>
            <CopyImageButton blob={result} />
          <EditInAnnotatorButton blob={result} filename={(file?.name ?? 'image').replace(/\.[^.]+$/, '') + '-upscaled.png'} />
          </div>
        </div>
      )}
    </div>
  );
}
