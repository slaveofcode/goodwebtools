import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { keepFormat } from '@/tools/image/canvas.lib';
import { overlayQr, type QrCorner } from '@/tools/image/qr-overlay.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

const CORNERS: { value: QrCorner; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
];

const TR: Record<Lang, {
  drop: string; dropSub: string; qrContent: string;
  corner: string; corners: Record<QrCorner, string>;
  size: string; backing: string; whiteCard: string;
  add: string; adding: string; clear: string; failed: string;
}> = {
  en: {
    drop: 'Drop an image or click to browse',
    dropSub: 'Add a QR code to a corner of an image · or paste (⌘V)',
    qrContent: 'QR content (text or URL)',
    corner: 'Corner',
    corners: {
      'top-left': 'Top left',
      'top-right': 'Top right',
      'bottom-left': 'Bottom left',
      'bottom-right': 'Bottom right',
    },
    size: 'Size',
    backing: 'Backing',
    whiteCard: 'White card',
    add: 'Add QR',
    adding: 'Adding…',
    clear: 'Clear',
    failed: 'Could not add the QR code',
  },
  id: {
    drop: 'Letakkan gambar atau klik untuk telusuri',
    dropSub: 'Tambahkan kode QR ke sudut gambar · atau tempel (⌘V)',
    qrContent: 'Konten QR (teks atau URL)',
    corner: 'Sudut',
    corners: {
      'top-left': 'Kiri atas',
      'top-right': 'Kanan atas',
      'bottom-left': 'Kiri bawah',
      'bottom-right': 'Kanan bawah',
    },
    size: 'Ukuran',
    backing: 'Alas',
    whiteCard: 'Kartu putih',
    add: 'Tambah QR',
    adding: 'Menambahkan…',
    clear: 'Bersihkan',
    failed: 'Tidak dapat menambahkan kode QR',
  },
};

export default function ImageQr({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('https://goodwebtools.com');
  const [corner, setCorner] = useState<QrCorner>('bottom-right');
  const [sizePercent, setSizePercent] = useState(18);
  const [card, setCard] = useState(true);
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
    ? file.name.replace(/\.[^.]+$/, '') + '-qr.' + keepFormat(file.type).ext
    : 'image-qr.png';

  const run = async () => {
    if (!file || !content.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await overlayQr(file, {
        content: content.trim(),
        corner,
        sizePercent,
        card,
      });
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
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <label className="block space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.qrContent}
        </span>
        <input
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
        />
      </label>

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.corner}
        </span>
        <div className="flex flex-wrap gap-2">
          {CORNERS.map(({ value }) => (
            <Button
              key={value}
              variant={corner === value ? 'primary' : 'secondary'}
              aria-pressed={corner === value}
              onClick={() => setCorner(value)}
            >
              {t.corners[value]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex-1 space-y-1.5">
          <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span>{t.size}</span>
            <span>{sizePercent}%</span>
          </span>
          <input
            type="range"
            min={1}
            max={100}
            value={sizePercent}
            onChange={e => setSizePercent(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </label>
        <div className="space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t.backing}
          </span>
          <Button variant={card ? 'primary' : 'secondary'} aria-pressed={card} onClick={() => setCard(c => !c)}>
            {t.whiteCard}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || !content.trim() || busy}>
          {busy ? t.adding : t.add}
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
