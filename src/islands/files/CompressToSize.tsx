import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { ResultActions } from '@/components/ui/ResultActions';
import { usePasteImage } from '@/hooks/usePasteImage';
import { TARGET_PRESETS, targetToBytes, pctSmaller, formatSize, type SizeUnit } from '@/tools/files/compress-target.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; target: string; custom: string;
  imageFormat: string; compress: string; working: string; failed: string;
  original: string; result: string; smaller: string; missed: (b: string) => string;
  rasterNote: string;
}> = {
  en: {
    intro: 'Compress a JPG, PNG, WebP or PDF down to a target file size — perfect for upload limits (e.g. 100 KB, 500 KB). Everything runs in your browser; your file is never uploaded.',
    drop: 'Drop an image or PDF, or click to browse',
    dropSub: 'JPG, PNG, WebP or PDF · or paste an image (⌘V)',
    target: 'Target size',
    custom: 'Custom',
    imageFormat: 'Image output',
    compress: 'Compress',
    working: 'Compressing…',
    failed: 'Could not compress this file.',
    original: 'Original',
    result: 'Result',
    smaller: 'smaller',
    missed: b => `Couldn’t reach the target — this is the smallest achievable (${b}). Try a larger target.`,
    rasterNote: 'To hit the target, pages were flattened to images, so the text is no longer selectable.',
  },
  id: {
    intro: 'Kompres JPG, PNG, WebP, atau PDF hingga ukuran target — pas untuk batas unggah (mis. 100 KB, 500 KB). Semuanya berjalan di browser Anda; file tidak pernah diunggah.',
    drop: 'Letakkan gambar atau PDF, atau klik untuk memilih',
    dropSub: 'JPG, PNG, WebP, atau PDF · atau tempel gambar (⌘V)',
    target: 'Ukuran target',
    custom: 'Kustom',
    imageFormat: 'Format gambar',
    compress: 'Kompres',
    working: 'Mengompres…',
    failed: 'Tidak dapat mengompres file ini.',
    original: 'Asli',
    result: 'Hasil',
    smaller: 'lebih kecil',
    missed: b => `Tidak dapat mencapai target — ini yang terkecil bisa dicapai (${b}). Coba target lebih besar.`,
    rasterNote: 'Untuk mencapai target, halaman diratakan menjadi gambar, sehingga teks tidak lagi bisa diseleksi.',
  },
};

export default function CompressToSize({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [targetBytes, setTargetBytes] = useState(100 * 1024);
  const [customValue, setCustomValue] = useState('100');
  const [customUnit, setCustomUnit] = useState<SizeUnit>('KB');
  const [format, setFormat] = useState<'jpeg' | 'webp'>('jpeg');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; achieved: boolean; rasterized?: boolean; name: string } | null>(null);

  const isPdf = file ? (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) : false;
  const isImage = file ? file.type.startsWith('image/') : false;

  const onDrop = (files: File[]) => {
    const f = files.find(x => x.type.startsWith('image/') || x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');
  };
  usePasteImage(f => onDrop([f]));

  const applyCustom = () => {
    const v = Number(customValue);
    if (Number.isFinite(v) && v > 0) setTargetBytes(targetToBytes(v, customUnit));
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const base = file.name.replace(/\.[^.]+$/, '');
      if (isPdf) {
        const { compressPdfToTarget } = await import('@/tools/pdf/pdf-to-size.lib');
        const r = await compressPdfToTarget(file, targetBytes);
        setResult({ blob: r.blob, achieved: r.achieved, rasterized: r.rasterized, name: `${base}-compressed.pdf` });
      } else if (isImage) {
        const { compressImageToTarget } = await import('@/tools/image/image-to-size.lib');
        const r = await compressImageToTarget(file, targetBytes, format);
        setResult({ blob: r.blob, achieved: r.achieved, name: `${base}-compressed.${format === 'webp' ? 'webp' : 'jpg'}` });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={onDrop} accept="image/*,application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      {file && (
        <>
          <p className="text-sm">
            <span className="font-bold">{file.name}</span>{' '}
            <span className="text-muted-foreground">· {t.original}: {formatSize(file.size)}</span>
          </p>

          <div className="space-y-1.5">
            <span className="block text-sm font-semibold">{t.target}</span>
            <div className="flex flex-wrap items-center gap-2">
              {TARGET_PRESETS.map(p => (
                <button key={p.bytes} onClick={() => setTargetBytes(p.bytes)}
                  aria-pressed={targetBytes === p.bytes}
                  className={`border-2 px-3 py-1 text-sm font-medium transition-all ${targetBytes === p.bytes ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'}`}>
                  {p.label}
                </button>
              ))}
              <span className="flex items-center gap-1">
                <input type="number" min={1} value={customValue} onChange={e => setCustomValue(e.target.value)} onBlur={applyCustom}
                  className="w-20 border-2 border-border bg-muted p-1.5 text-sm" />
                <select value={customUnit} onChange={e => { setCustomUnit(e.target.value as SizeUnit); }}
                  className="border-2 border-border bg-background px-2 py-1.5 text-sm">
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                </select>
                <Button variant="secondary" onClick={applyCustom} className="text-xs">{t.custom}</Button>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">→ {formatSize(targetBytes)}</p>
          </div>

          {isImage && (
            <div className="space-y-1 text-sm">
              <span className="block font-semibold">{t.imageFormat}</span>
              <div className="flex gap-1">
                {(['jpeg', 'webp'] as const).map(f => (
                  <button key={f} onClick={() => setFormat(f)} aria-pressed={format === f}
                    className={`border-2 px-3 py-1 font-medium transition-all ${format === f ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'}`}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button onClick={run} disabled={busy || targetBytes <= 0}>{busy ? t.working : t.compress}</Button>
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span className="font-mono">{formatSize(result.blob.size)}</span>
            {file && result.blob.size < file.size && (
              <span className="font-bold text-green-600 dark:text-green-400">−{pctSmaller(file.size, result.blob.size)}% {t.smaller}</span>
            )}
          </div>
          {!result.achieved && <Alert variant="error">{t.missed(formatSize(result.blob.size))}</Alert>}
          {result.rasterized && <p className="text-xs text-muted-foreground">{t.rasterNote}</p>}
          {result.blob.type.startsWith('image/')
            ? <ImageResult blob={result.blob} filename={result.name} originalSize={file?.size} />
            : <ResultActions blob={result.blob} filename={result.name} />}
        </div>
      )}
    </div>
  );
}
