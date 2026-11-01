import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { processImage, formatBytes } from '@/tools/image/canvas.lib';
import { ImageDecodeError, type DecodeFailure } from '@/tools/image/decode.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import { isLikelyHeic } from '@/tools/image/heic.lib';
import { useReportable } from '@/hooks/useReportable';
import { setLastError } from '@/services/report/reporter';
import { breadcrumb } from '@/services/report/breadcrumbs';
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
  errors: Record<DecodeFailure, string>;
  scaled: (w: number, h: number) => string;
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
    errors: {
      empty: 'This file is empty — pick the image again.',
      heic: 'This HEIC photo couldn’t be decoded. Try the HEIC to JPG tool first.',
      tiff: 'Your browser can’t open TIFF images. Open this page in Safari, or convert the image to PNG or JPG first.',
      unsupported: 'This file isn’t an image your browser can open — it may be damaged or in another format.',
      'too-large': 'This image is too large for your device’s memory. Make it smaller with the Image Resizer first.',
    },
    scaled: (w, h) => `Scaled down to ${w}×${h} px to fit your browser’s image size limit.`,
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
    errors: {
      empty: 'Berkas ini kosong — pilih gambarnya lagi.',
      heic: 'Foto HEIC ini tidak bisa dibaca. Coba tool HEIC ke JPG dulu.',
      tiff: 'Browser Anda tidak bisa membuka gambar TIFF. Buka halaman ini di Safari, atau ubah gambar ke PNG atau JPG dulu.',
      unsupported: 'Berkas ini bukan gambar yang bisa dibuka browser Anda — mungkin rusak atau berformat lain.',
      'too-large': 'Gambar ini terlalu besar untuk memori perangkat Anda. Perkecil dulu dengan Pengubah Ukuran Gambar.',
    },
    scaled: (w, h) => `Diperkecil ke ${w}×${h} px agar sesuai batas ukuran gambar di browser Anda.`,
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
  const [scaledTo, setScaledTo] = useState<{ w: number; h: number } | null>(null);

  useReportable({ toolId: 'image-compress', file });

  const fmt = FORMATS.find(f => f.mime === mime)!;
  const outName = file ? file.name.replace(/\.[^.]+$/, '') + '.' + fmt.ext : `image.${fmt.ext}`;

  const onDrop = (files: File[]) => {
    // HEIC often arrives with an empty MIME type; let the decoder judge anything that isn't clearly non-image.
    setFile(files.find(f => f.type.startsWith('image/')) ?? files.find(f => f.type === '' || isLikelyHeic(f)) ?? null);
    setResult(null);
    setScaledTo(null);
    setError('');
    breadcrumb('image-compress:file-selected', { type: files[0]?.type, size: files[0]?.size });
  };

  usePasteImage(f => onDrop([f]));

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    setScaledTo(null);
    try {
      const { blob, width, height, scaled } = await processImage(file, { mimeType: mime, quality: quality / 100 });
      setResult(blob);
      if (scaled) setScaledTo({ w: width, h: height });
    } catch (e) {
      setLastError(e instanceof Error ? e : new Error(String(e)));
      setError(e instanceof ImageDecodeError ? t.errors[e.kind] : e instanceof Error ? e.message : t.failed);
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
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setScaledTo(null); setError(''); }}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && scaledTo && <p className="text-sm text-muted-foreground" data-testid="scaled-note">{t.scaled(scaledTo.w, scaledTo.h)}</p>}
      {result && <ImageResult blob={result} filename={outName} originalSize={file?.size} />}
    </div>
  );
}
