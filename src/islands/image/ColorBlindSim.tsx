import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { usePasteImage } from '@/hooks/usePasteImage';
import { CVD_TYPES, simulateImageData } from '@/tools/image/colorblind.lib';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'See how your design looks to someone with colour blindness. Drop an image and switch between types of colour-vision deficiency, side by side with the original. Everything runs in your browser.',
    drop: 'Drop an image or click to browse', dropSub: 'JPG, PNG, WebP · or paste an image (⌘V)',
    type: 'Simulation', original: 'Original', download: 'Download simulated', change: 'Change image',
  },
  id: {
    intro: 'Lihat bagaimana desain Anda tampak bagi penyandang buta warna. Letakkan gambar dan beralih antar jenis defisiensi penglihatan warna, berdampingan dengan aslinya. Semuanya berjalan di browser Anda.',
    drop: 'Letakkan gambar atau klik untuk memilih', dropSub: 'JPG, PNG, WebP · atau tempel gambar (⌘V)',
    type: 'Simulasi', original: 'Asli', download: 'Unduh hasil simulasi', change: 'Ganti gambar',
  },
};

const MAX_W = 900;

export default function ColorBlindSim({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [type, setType] = useState('deuteranopia');
  const origRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<HTMLCanvasElement | null>(null);

  const loadImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { setImg(image); URL.revokeObjectURL(url); };
    image.src = url;
  };
  const onDrop = (files: File[]) => { const f = files.find(x => x.type.startsWith('image/')); if (f) loadImage(f); };
  usePasteImage(f => loadImage(f));

  useEffect(() => {
    if (!img) return;
    const w = Math.min(img.naturalWidth, MAX_W);
    const h = (img.naturalHeight / img.naturalWidth) * w;
    const orig = origRef.current;
    const sim = simRef.current;
    if (!orig || !sim) return;
    for (const c of [orig, sim]) { c.width = w; c.height = h; }
    const octx = orig.getContext('2d');
    const sctx = sim.getContext('2d');
    if (!octx || !sctx) return;
    octx.drawImage(img, 0, 0, w, h);
    sctx.drawImage(img, 0, 0, w, h);
    const data = sctx.getImageData(0, 0, w, h);
    simulateImageData(data.data, type);
    sctx.putImageData(data, 0, 0);
  }, [img, type]);

  const download = () => {
    simRef.current?.toBlob(blob => {
      if (!blob) return;
      downloadService.download(blob, `colorblind-${type}.png`);
    }, 'image/png');
  };

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
        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold">{t.type}</span>
            <div className="flex flex-wrap gap-2">
              {CVD_TYPES.map(c => (
                <button key={c.id} onClick={() => setType(c.id)} aria-pressed={type === c.id}
                  className={`border-2 px-2.5 py-1 text-xs font-medium transition-all ${type === c.id ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.original}</span>
              <canvas ref={origRef} className="w-full border-2 border-border" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{CVD_TYPES.find(c => c.id === type)?.name}</span>
              <canvas ref={simRef} className="w-full border-2 border-border" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>{t.download}</Button>
            <Button variant="secondary" onClick={() => setImg(null)}>{t.change}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
