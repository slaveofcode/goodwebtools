import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { downloadService } from '@/services/download';
import { encodeCanvas, formatBytes } from '@/tools/image/canvas.lib';
import { gridLayout } from '@/tools/image/collage.lib';
import { fitRect } from '@/tools/image/social-resize.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Combine several photos into one collage on a grid — pick the columns, gap and background, then download. Made in your browser; nothing is uploaded.',
    drop: 'Drop photos or click to browse', dropSub: 'Add 2 or more images',
    cols: 'Columns', gap: 'Gap', bg: 'Background', size: 'Output width', make: 'Make collage', making: 'Building…',
    download: 'Download', result: 'Collage', clear: 'Clear', failed: 'Could not build the collage.',
  },
  id: {
    intro: 'Gabungkan beberapa foto menjadi satu kolase pada grid — pilih kolom, jarak, dan latar, lalu unduh. Dibuat di browser Anda; tidak ada yang diunggah.',
    drop: 'Letakkan foto atau klik untuk memilih', dropSub: 'Tambahkan 2 gambar atau lebih',
    cols: 'Kolom', gap: 'Jarak', bg: 'Latar', size: 'Lebar output', make: 'Buat kolase', making: 'Membuat…',
    download: 'Unduh', result: 'Kolase', clear: 'Bersihkan', failed: 'Tidak dapat membuat kolase.',
  },
};

export default function PhotoCollage({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [files, setFiles] = useState<File[]>([]);
  const [cols, setCols] = useState(2);
  const [gap, setGap] = useState(16);
  const [bg, setBg] = useState('#ffffff');
  const [width, setWidth] = useState(1080);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const onDrop = (dropped: File[]) => {
    const imgs = dropped.filter(f => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    setFiles(prev => [...prev, ...imgs]);
    setResult(null);
  };

  const make = async () => {
    if (files.length === 0) return;
    setBusy(true); setError('');
    try {
      const bitmaps = await Promise.all(files.map(f => createImageBitmap(f)));
      const rows = Math.ceil(bitmaps.length / cols);
      // Derive a square-ish cell from the first image's aspect for the height.
      const cellW = (width - gap * (cols + 1)) / cols;
      const avgAspect = bitmaps.reduce((s, b) => s + b.width / b.height, 0) / bitmaps.length;
      const cellH = cellW / avgAspect;
      const height = Math.round(cellH * rows + gap * (rows + 1));

      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const cells = gridLayout(bitmaps.length, cols, width, height, gap);
      cells.forEach(cell => {
        const b = bitmaps[cell.index];
        const r = fitRect(b.width, b.height, cell.w, cell.h, 'cover');
        ctx.drawImage(b, r.sx, r.sy, r.sw, r.sh, cell.x + r.dx, cell.y + r.dy, r.dw, r.dh);
      });
      bitmaps.forEach(b => b.close?.());

      const blob = await encodeCanvas(canvas, 'image/png');
      setResult(blob);
      setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const download = () => { if (result) downloadService.download(result, 'collage.png'); };
  const clear = () => { setFiles([]); setResult(null); setError(''); };

  const input = 'h-9 border-2 border-border bg-muted px-2 text-sm';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={onDrop} accept="image/*" multiple>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      {files.length > 0 && (
        <p className="text-sm text-muted-foreground">{files.length} · {files.map(f => f.name).join(', ')}</p>
      )}

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1"><span className="font-bold uppercase tracking-wide text-muted-foreground">{t.cols}</span>
          <select value={cols} onChange={e => setCols(Number(e.target.value))} className={input}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="font-bold uppercase tracking-wide text-muted-foreground">{t.gap}</span>
          <input type="number" min={0} max={100} value={gap} onChange={e => setGap(Math.max(0, Number(e.target.value)))} className={`${input} w-20`} /></label>
        <label className="flex flex-col gap-1"><span className="font-bold uppercase tracking-wide text-muted-foreground">{t.size}</span>
          <input type="number" min={200} max={4000} step={20} value={width} onChange={e => setWidth(Math.max(200, Number(e.target.value)))} className={`${input} w-24`} /></label>
        <label className="flex flex-col gap-1"><span className="font-bold uppercase tracking-wide text-muted-foreground">{t.bg}</span>
          <input type="color" value={bg} onChange={e => setBg(e.target.value)} className="h-9 w-14 border-2 border-border" /></label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={make} disabled={busy || files.length === 0}>{busy ? t.making : t.make}</Button>
        <Button variant="ghost" onClick={clear}>{t.clear}</Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          <img src={resultUrl} alt="" className="max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <Button onClick={download}><Download className="h-4 w-4" />{t.download}</Button>
        </div>
      )}
    </div>
  );
}
