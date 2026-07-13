import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { downloadService } from '@/services/download.service';
import { formatBytes } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

type Scale = 2 | 3 | 4;

// Guardrail: a 4× upscale of a large image is a lot of pixels/memory.
const MAX_INPUT_PIXELS = 1_200_000; // ~1.2 MP (e.g. 1200×1000)

async function loadModel(scale: Scale) {
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

export default function ImageUpscale() {
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
    // Measure input size and guard against very large images.
    const bmp = await createImageBitmap(target);
    setSrcDims({ w: bmp.width, h: bmp.height });
    if (bmp.width * bmp.height > MAX_INPUT_PIXELS) {
      bmp.close?.();
      setError(`Image is too large to upscale ${s}× in the browser (max ~1.2 MP). Resize it first.`);
      return;
    }
    bmp.close?.();

    setBusy(true);
    setPercent(0);
    setStage('Loading model…');
    try {
      const upscaler = await loadModel(s);
      setStage(`Upscaling ${s}×…`);
      const src = URL.createObjectURL(target);
      const dataUrl: string = await upscaler.upscale(src, {
        output: 'base64',
        patchSize: 64,
        padding: 4,
        progress: (rate: number) => setPercent(Math.round(rate * 100)),
      });
      URL.revokeObjectURL(src);
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
      setError(e instanceof Error ? e.message : 'Upscaling failed.');
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
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Enlarges an image with an on-device AI model (ESRGAN) · or paste (⌘V)
          </p>
        </div>
      </Dropzone>

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Scale</span>
        <div className="flex flex-wrap gap-2">
          {([2, 3, 4] as Scale[]).map(s => (
            <Button key={s} variant={scale === s ? 'primary' : 'secondary'} aria-pressed={scale === s} onClick={() => changeScale(s)} disabled={busy}>
              {s}×
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Runs entirely in your browser — the image never leaves your device. Best on smaller images
        (icons, logos, old photos); large images are slower and capped at ~1.2 MP. The model
        downloads once (~1 MB), then it's cached.
      </p>

      {busy && <ProgressBar percent={percent} label={stage || 'Working…'} />}
      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Result</span>
            {srcDims && outDims && (
              <span>{srcDims.w}×{srcDims.h} → <span className="font-bold">{outDims.w}×{outDims.h}</span></span>
            )}
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          <img src={resultUrl} alt="Upscaled" className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
            <CopyImageButton blob={result} />
          </div>
        </div>
      )}
    </div>
  );
}
