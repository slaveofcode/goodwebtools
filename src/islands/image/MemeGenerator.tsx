import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { usePasteImage } from '@/hooks/usePasteImage';
import { wrapText } from '@/tools/image/meme.lib';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Make a classic meme: drop an image, add top and bottom text, and download it. The bold outlined caption style is applied automatically. Everything runs in your browser — nothing is uploaded.',
    drop: 'Drop an image or click to browse', dropSub: 'JPG, PNG, WebP · or paste an image (⌘V)',
    top: 'Top text', bottom: 'Bottom text', size: 'Text size', download: 'Download meme', change: 'Change image',
  },
  id: {
    intro: 'Buat meme klasik: letakkan gambar, tambahkan teks atas dan bawah, lalu unduh. Gaya teks tebal bergaris otomatis diterapkan. Semuanya berjalan di browser Anda — tidak ada yang diunggah.',
    drop: 'Letakkan gambar atau klik untuk memilih', dropSub: 'JPG, PNG, WebP · atau tempel gambar (⌘V)',
    top: 'Teks atas', bottom: 'Teks bawah', size: 'Ukuran teks', download: 'Unduh meme', change: 'Ganti gambar',
  },
};

const MAX_W = 1000;

export default function MemeGenerator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [top, setTop] = useState('');
  const [bottom, setBottom] = useState('');
  const [scale, setScale] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { setImg(image); URL.revokeObjectURL(url); };
    image.src = url;
  };

  const onDrop = (files: File[]) => {
    const f = files.find(x => x.type.startsWith('image/'));
    if (f) loadImage(f);
  };
  usePasteImage(f => loadImage(f));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = Math.min(img.naturalWidth, MAX_W);
    const h = (img.naturalHeight / img.naturalWidth) * w;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    const fontSize = (w / 10) * scale;
    ctx.font = `bold ${fontSize}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, fontSize / 12);
    ctx.lineJoin = 'round';
    const measure = (s: string) => ctx.measureText(s).width;
    const maxW = w * 0.92;
    const lineH = fontSize * 1.05;

    const drawBlock = (text: string, position: 'top' | 'bottom') => {
      const lines = wrapText(text.toUpperCase(), maxW, measure);
      lines.forEach((line, i) => {
        const y = position === 'top'
          ? fontSize + i * lineH
          : h - 12 - (lines.length - 1 - i) * lineH;
        ctx.strokeText(line, w / 2, y);
        ctx.fillText(line, w / 2, y);
      });
    };
    ctx.textBaseline = 'alphabetic';
    if (top.trim()) drawBlock(top, 'top');
    if (bottom.trim()) drawBlock(bottom, 'bottom');
  }, [img, top, bottom, scale]);

  const download = () => {
    canvasRef.current?.toBlob(blob => {
      if (!blob) return;
      downloadService.download(blob, 'meme.png');
    }, 'image/png');
  };

  const input = 'w-full border-2 border-border bg-muted p-2 text-sm';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!img ? (
        <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="flex justify-center border-2 border-border bg-muted p-2">
            <canvas ref={canvasRef} className="max-h-[70vh] w-auto max-w-full" />
          </div>
          <div className="space-y-3">
            <label className="space-y-1 text-sm"><span className="block font-semibold">{t.top}</span>
              <input value={top} onChange={e => setTop(e.target.value)} className={input} /></label>
            <label className="space-y-1 text-sm"><span className="block font-semibold">{t.bottom}</span>
              <input value={bottom} onChange={e => setBottom(e.target.value)} className={input} /></label>
            <label className="space-y-1 text-sm"><span className="block font-semibold">{t.size}: {scale.toFixed(1)}×</span>
              <input type="range" min={0.5} max={1.8} step={0.1} value={scale} onChange={e => setScale(Number(e.target.value))} className="w-full accent-accent" /></label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={download}>{t.download}</Button>
              <Button variant="secondary" onClick={() => { setImg(null); setTop(''); setBottom(''); }}>{t.change}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
