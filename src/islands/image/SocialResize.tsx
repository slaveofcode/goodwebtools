import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { downloadService } from '@/services/download';
import { encodeCanvas, formatBytes } from '@/tools/image/canvas.lib';
import { SOCIAL_PRESETS, fitRect, type FitMode } from '@/tools/image/social-resize.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Resize an image to exact social-media dimensions — Instagram, TikTok, YouTube, Facebook, X and LinkedIn. Done in your browser, nothing uploaded.',
    drop: 'Drop an image or click to browse', dropSub: 'It will be resized to the size you pick',
    preset: 'Size', fit: 'Fit', cover: 'Crop to fill', contain: 'Fit (with background)', bg: 'Background',
    download: 'Download', failed: 'Could not process this image.', result: 'Result',
  },
  id: {
    intro: 'Ubah ukuran gambar ke dimensi media sosial yang tepat — Instagram, TikTok, YouTube, Facebook, X, dan LinkedIn. Dilakukan di browser Anda, tanpa unggah.',
    drop: 'Letakkan gambar atau klik untuk memilih', dropSub: 'Akan diubah ke ukuran yang Anda pilih',
    preset: 'Ukuran', fit: 'Penyesuaian', cover: 'Potong penuh', contain: 'Muat (dengan latar)', bg: 'Latar',
    download: 'Unduh', failed: 'Tidak dapat memproses gambar ini.', result: 'Hasil',
  },
};

export default function SocialResize({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [presetId, setPresetId] = useState(SOCIAL_PRESETS[0].id);
  const [fit, setFit] = useState<FitMode>('cover');
  const [bg, setBg] = useState('#ffffff');
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preset = SOCIAL_PRESETS.find(p => p.id === presetId) ?? SOCIAL_PRESETS[0];

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const run = async (f: File, dstW: number, dstH: number, mode: FitMode, background: string) => {
    setBusy(true); setError('');
    try {
      const bmp = await createImageBitmap(f);
      const canvas = document.createElement('canvas');
      canvas.width = dstW; canvas.height = dstH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      if (mode === 'contain') { ctx.fillStyle = background; ctx.fillRect(0, 0, dstW, dstH); }
      const r = fitRect(bmp.width, bmp.height, dstW, dstH, mode);
      ctx.drawImage(bmp, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
      bmp.close?.();
      const blob = await encodeCanvas(canvas, 'image/png');
      setResult(blob);
      setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const rerun = (f = file, id = presetId, mode = fit, background = bg) => {
    const p = SOCIAL_PRESETS.find(x => x.id === id) ?? SOCIAL_PRESETS[0];
    if (f) void run(f, p.w, p.h, mode, background);
  };

  const onDrop = (files: File[]) => {
    const img = files.find(f => f.type.startsWith('image/'));
    if (!img) return;
    setFile(img);
    rerun(img, presetId, fit, bg);
  };

  const download = () => {
    if (!result || !file) return;
    downloadService.download(result, file.name.replace(/\.[^.]+$/, '') + `-${preset.w}x${preset.h}.png`);
  };

  const input = 'h-9 border-2 border-border bg-muted px-2 text-sm';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.preset}</span>
          <select value={presetId} onChange={e => { setPresetId(e.target.value); rerun(file, e.target.value, fit, bg); }} className={input}>
            {SOCIAL_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label} — {p.w}×{p.h}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.fit}</span>
          <select value={fit} onChange={e => { const m = e.target.value as FitMode; setFit(m); rerun(file, presetId, m, bg); }} className={input}>
            <option value="cover">{t.cover}</option>
            <option value="contain">{t.contain}</option>
          </select>
        </label>
        {fit === 'contain' && (
          <label className="flex flex-col gap-1">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.bg}</span>
            <input type="color" value={bg} onChange={e => { setBg(e.target.value); rerun(file, presetId, fit, e.target.value); }} className="h-9 w-14 border-2 border-border" />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span className="font-mono text-muted-foreground">{preset.w}×{preset.h} · {formatBytes(result.size)}</span>
          </div>
          <img src={resultUrl} alt="" className="max-h-[60vh] w-auto max-w-full border-2 border-border" />
          <Button onClick={download}><Download className="h-4 w-4" />{t.download}</Button>
        </div>
      )}
    </div>
  );
}
