import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { processImage, formatBytes } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

const FORMATS = [
  { mime: 'image/webp', ext: 'webp', label: { en: 'WebP (smaller)', id: 'WebP (lebih kecil)' } },
  { mime: 'image/jpeg', ext: 'jpg', label: { en: 'JPEG', id: 'JPEG' } },
];

const TR: Record<Lang, {
  dropTitle: string;
  dropHint: string;
  format: string;
  quality: string;
  compressing: string;
  compress: string;
  clear: string;
  failed: string;
}> = {
  en: {
    dropTitle: 'Drop an image or click to browse',
    dropHint: 'Shrink an image by re-encoding it · or paste (⌘V)',
    format: 'Format',
    quality: 'Quality',
    compressing: 'Compressing…',
    compress: 'Compress',
    clear: 'Clear',
    failed: 'Compression failed',
  },
  id: {
    dropTitle: 'Jatuhkan gambar atau klik untuk menelusuri',
    dropHint: 'Perkecil ukuran gambar dengan mengode ulang · atau tempel (⌘V)',
    format: 'Format',
    quality: 'Kualitas',
    compressing: 'Mengompres…',
    compress: 'Kompres',
    clear: 'Bersihkan',
    failed: 'Kompresi gagal',
  },
};

export default function ImageCompress({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [mime, setMime] = useState('image/webp');
  const [quality, setQuality] = useState(75);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fmt = FORMATS.find(f => f.mime === mime)!;
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
      const { blob } = await processImage(file, { mimeType: mime, quality: quality / 100 });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropTitle}</p>
          <p className="text-sm text-muted-foreground">{t.dropHint}</p>
        </div>
      </Dropzone>

      {file && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
        </p>
      )}

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.format}
        </span>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(({ mime: value, label }) => (
            <Button
              key={value}
              variant={mime === value ? 'primary' : 'secondary'}
              aria-pressed={mime === value}
              onClick={() => setMime(value)}
            >
              {label[lang] ?? label.en}
            </Button>
          ))}
        </div>
      </div>

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

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? t.compressing : t.compress}
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
