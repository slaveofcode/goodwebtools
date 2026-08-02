import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { watermarkImage, keepFormat, scaleToFontScale, type WatermarkLayout } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

const LAYOUTS: { value: WatermarkLayout; label: string }[] = [
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'tiled', label: 'Tiled' },
  { value: 'bottom-right', label: 'Corner' },
];

const TR: Record<Lang, {
  dropTitle: string;
  dropHint: string;
  watermarkText: string;
  layout: string;
  layouts: Record<WatermarkLayout, string>;
  scale: string;
  opacity: string;
  color: string;
  stamping: string;
  addWatermark: string;
  clear: string;
  watermarkFailed: string;
}> = {
  en: {
    dropTitle: 'Drop an image or click to browse',
    dropHint: 'Stamp a text watermark onto an image · or paste (⌘V)',
    watermarkText: 'Watermark text',
    layout: 'Layout',
    layouts: { diagonal: 'Diagonal', tiled: 'Tiled', 'bottom-right': 'Corner' },
    scale: 'Scale',
    opacity: 'Opacity',
    color: 'Color',
    stamping: 'Stamping…',
    addWatermark: 'Add watermark',
    clear: 'Clear',
    watermarkFailed: 'Watermark failed',
  },
  id: {
    dropTitle: 'Jatuhkan gambar atau klik untuk memilih',
    dropHint: 'Bubuhkan watermark teks ke gambar · atau tempel (⌘V)',
    watermarkText: 'Teks watermark',
    layout: 'Tata letak',
    layouts: { diagonal: 'Diagonal', tiled: 'Ubin', 'bottom-right': 'Sudut' },
    scale: 'Skala',
    opacity: 'Opasitas',
    color: 'Warna',
    stamping: 'Membubuhkan…',
    addWatermark: 'Tambah watermark',
    clear: 'Bersihkan',
    watermarkFailed: 'Gagal membuat watermark',
  },
};

export default function ImageWatermark({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('© GoodWebTools');
  const [layout, setLayout] = useState<WatermarkLayout>('diagonal');
  const [scale, setScale] = useState(30);
  const [opacity, setOpacity] = useState(60);
  const [color, setColor] = useState('#808080');
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files.find(f => f.type.startsWith('image/')) ?? null);
    setResult(null);
    setError('');
  };

  usePasteImage(f => onDrop([f]));

  const outName = file
    ? file.name.replace(/\.[^.]+$/, '') + '-watermarked.' + keepFormat(file.type).ext
    : 'watermarked.png';

  const run = async () => {
    if (!file || !text.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await watermarkImage(file, {
        text: text.trim(),
        layout,
        fontScale: scaleToFontScale(scale),
        opacity: opacity / 100,
        color,
      });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.watermarkFailed);
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

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <label className="block space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.watermarkText}
        </span>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
        />
      </label>

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.layout}
        </span>
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map(({ value }) => (
            <Button
              key={value}
              variant={layout === value ? 'primary' : 'secondary'}
              aria-pressed={layout === value}
              onClick={() => setLayout(value)}
            >
              {t.layouts[value]}
            </Button>
          ))}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <span>{t.scale}</span>
          <span>{scale}%</span>
        </span>
        <input
          type="range"
          min={1}
          max={100}
          value={scale}
          onChange={e => setScale(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </label>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex-1 space-y-1.5">
          <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span>{t.opacity}</span>
            <span>{opacity}%</span>
          </span>
          <input
            type="range"
            min={10}
            max={100}
            value={opacity}
            onChange={e => setOpacity(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t.color}
          </span>
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="h-11 w-16 cursor-pointer border-2 border-border bg-muted"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || !text.trim() || busy}>
          {busy ? t.stamping : t.addWatermark}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} />}
    </div>
  );
}
