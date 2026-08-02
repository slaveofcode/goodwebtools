import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { processImage } from '@/tools/image/canvas.lib';
import { imageToIco, imageToGif, imageToSvg, canvasSupportsType } from '@/tools/image/encode.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  drop: string;
  sub: (avif: boolean) => string;
  outputFormat: string;
  quality: string;
  converting: string;
  convertTo: (label: string) => string;
  clear: string;
  conversionFailed: string;
  notes: Record<string, string>;
}> = {
  en: {
    drop: 'Drop an image or click to browse',
    sub: (avif) => `Convert to PNG, JPEG, WebP${avif ? ', AVIF' : ''}, GIF, ICO, or SVG · or paste (⌘V)`,
    outputFormat: 'Output format',
    quality: 'Quality',
    converting: 'Converting…',
    convertTo: (label) => `Convert to ${label}`,
    clear: 'Clear',
    conversionFailed: 'Conversion failed',
    notes: {
      avif: 'AVIF (AV1 image) — great compression, modern browsers.',
      gif: 'Single frame, 256 colors.',
      ico: 'Multi-size favicon: 16, 32, and 48px in one .ico.',
      svg: 'Wraps the image inside an SVG (embedded, not vectorized).',
    },
  },
  id: {
    drop: 'Letakkan gambar atau klik untuk memilih',
    sub: (avif) => `Konversi ke PNG, JPEG, WebP${avif ? ', AVIF' : ''}, GIF, ICO, atau SVG · atau tempel (⌘V)`,
    outputFormat: 'Format keluaran',
    quality: 'Kualitas',
    converting: 'Mengonversi…',
    convertTo: (label) => `Konversi ke ${label}`,
    clear: 'Bersihkan',
    conversionFailed: 'Konversi gagal',
    notes: {
      avif: 'AVIF (AV1 image) — kompresi bagus, browser modern.',
      gif: 'Satu frame, 256 warna.',
      ico: 'Favicon multi-ukuran: 16, 32, dan 48px dalam satu .ico.',
      svg: 'Membungkus gambar di dalam SVG (disematkan, bukan divektorkan).',
    },
  },
};

type Kind = 'canvas' | 'ico' | 'gif' | 'svg';

interface Format {
  key: string;
  ext: string;
  label: string;
  kind: Kind;
  mime?: string;
  lossy?: boolean;
  detect?: string; // feature-detect this mime before offering
  note?: string;
}

const FORMATS: Format[] = [
  { key: 'png', ext: 'png', label: 'PNG', kind: 'canvas', mime: 'image/png' },
  { key: 'jpeg', ext: 'jpg', label: 'JPEG', kind: 'canvas', mime: 'image/jpeg', lossy: true },
  { key: 'webp', ext: 'webp', label: 'WebP', kind: 'canvas', mime: 'image/webp', lossy: true },
  {
    key: 'avif',
    ext: 'avif',
    label: 'AVIF',
    kind: 'canvas',
    mime: 'image/avif',
    lossy: true,
    detect: 'image/avif',
    note: 'AVIF (AV1 image) — great compression, modern browsers.',
  },
  { key: 'gif', ext: 'gif', label: 'GIF', kind: 'gif', note: 'Single frame, 256 colors.' },
  {
    key: 'ico',
    ext: 'ico',
    label: 'ICO (favicon)',
    kind: 'ico',
    note: 'Multi-size favicon: 16, 32, and 48px in one .ico.',
  },
  {
    key: 'svg',
    ext: 'svg',
    label: 'SVG',
    kind: 'svg',
    note: 'Wraps the image inside an SVG (embedded, not vectorized).',
  },
];

export default function ImageConvert({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState('png');
  const [quality, setQuality] = useState(90);
  const [avifOk, setAvifOk] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    canvasSupportsType('image/avif').then(setAvifOk);
  }, []);

  const available = FORMATS.filter(f => !f.detect || (f.detect === 'image/avif' && avifOk));
  const fmt = available.find(f => f.key === key) ?? available[0];
  const outName = file ? file.name.replace(/\.[^.]+$/, '') + '.' + fmt.ext : `image.${fmt.ext}`;

  const onDrop = (files: File[]) => {
    setFile(files.find(f => f.type.startsWith('image/')) ?? null);
    setResult(null);
    setError('');
  };

  usePasteImage(f => onDrop([f]));

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      let blob: Blob;
      if (fmt.kind === 'ico') blob = await imageToIco(file);
      else if (fmt.kind === 'gif') blob = await imageToGif(file);
      else if (fmt.kind === 'svg') blob = await imageToSvg(file);
      else {
        const out = await processImage(file, {
          mimeType: fmt.mime!,
          quality: fmt.lossy ? quality / 100 : undefined,
        });
        blob = out.blob;
      }
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.conversionFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">
            {t.sub(avifOk)}
          </p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.outputFormat}
        </span>
        <div className="flex flex-wrap gap-2">
          {available.map(f => (
            <Button
              key={f.key}
              variant={fmt.key === f.key ? 'primary' : 'secondary'}
              aria-pressed={fmt.key === f.key}
              onClick={() => setKey(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {fmt.note && <p className="text-xs text-muted-foreground">{t.notes[fmt.key] ?? fmt.note}</p>}
      </div>

      {fmt.lossy && (
        <label className="block space-y-1.5">
          <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span>{t.quality}</span>
            <span>{quality}%</span>
          </span>
          <input
            type="range"
            min={10}
            max={100}
            value={quality}
            onChange={e => setQuality(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? t.converting : t.convertTo(fmt.label)}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} originalSize={file?.size} />}
    </div>
  );
}
