import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { CopyButton } from '@/components/ui/CopyButton';
import { extractPalette, type Swatch } from '@/tools/image/palette.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Extract the dominant color palette from any image — get the hex codes for design, CSS or moodboards. Runs in your browser; nothing is uploaded.',
    drop: 'Drop an image or click to browse', dropSub: 'PNG, JPG, WebP, GIF…',
    colors: 'Colors', count: 'Number of colors', copyAll: 'Copy all hex', copy: 'Copy', failed: 'Could not read this image.',
  },
  id: {
    intro: 'Ekstrak palet warna dominan dari gambar apa pun — dapatkan kode hex untuk desain, CSS, atau moodboard. Berjalan di browser Anda; tidak ada yang diunggah.',
    drop: 'Letakkan gambar atau klik untuk memilih', dropSub: 'PNG, JPG, WebP, GIF…',
    colors: 'Warna', count: 'Jumlah warna', copyAll: 'Salin semua hex', copy: 'Salin', failed: 'Tidak dapat membaca gambar ini.',
  },
};

export default function ImagePalette({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [k, setK] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (file: File, count: number) => {
    setBusy(true); setError('');
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 400 / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close?.();
      const { data } = ctx.getImageData(0, 0, w, h);
      setSwatches(extractPalette(data, count, 1));
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (files: File[]) => {
    const img = files.find(f => f.type.startsWith('image/'));
    if (!img) return;
    setFile(img);
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(img); });
    void run(img, k);
  };

  const changeK = (n: number) => {
    setK(n);
    if (file) void run(file, n);
  };

  const allHex = swatches.map(s => s.hex).join(', ');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {preview && (
        <div className="flex flex-wrap items-start gap-4">
          <img src={preview} alt="" className="max-h-48 w-auto border-2 border-border object-contain" />
          <label className="text-sm">
            <span className="mr-2 font-semibold">{t.count}</span>
            <select value={k} onChange={e => changeK(Number(e.target.value))} className="border-2 border-border bg-muted p-1">
              {[4, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}

      {swatches.length > 0 && !busy && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.colors}</span>
            <CopyButton value={allHex} label={t.copyAll} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {swatches.map(s => (
              <div key={s.hex} className="flex items-center gap-2 border-2 border-border bg-muted p-2">
                <span className="h-9 w-9 shrink-0 border-2 border-border" style={{ backgroundColor: s.hex }} />
                <span className="font-mono text-sm uppercase">{s.hex}</span>
                <span className="ml-auto"><CopyButton value={s.hex} label={t.copy} /></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
