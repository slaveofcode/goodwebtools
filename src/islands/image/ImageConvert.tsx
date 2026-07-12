import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { processImage } from '@/tools/image/canvas.lib';
import { imageToIco, imageToGif, imageToSvg, canvasSupportsType } from '@/tools/image/encode.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

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

export default function ImageConvert() {
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
      setError(e instanceof Error ? e.message : 'Conversion failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Convert to PNG, JPEG, WebP{avifOk ? ', AVIF' : ''}, GIF, ICO, or SVG · or paste (⌘V)
          </p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Output format
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
        {fmt.note && <p className="text-xs text-muted-foreground">{fmt.note}</p>}
      </div>

      {fmt.lossy && (
        <label className="block space-y-1.5">
          <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span>Quality</span>
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
          {busy ? 'Converting…' : `Convert to ${fmt.label}`}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} originalSize={file?.size} />}
    </div>
  );
}
