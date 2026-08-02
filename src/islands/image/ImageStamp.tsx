import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { keepFormat } from '@/tools/image/canvas.lib';
import {
  stampImage,
  STAMP_PRESETS,
  type StampFont,
  type StampPlacement,
} from '@/tools/image/stamp.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

const FONTS: { value: StampFont; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
  { value: 'condensed', label: 'Condensed' },
];

const PLACEMENTS: { value: StampPlacement; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
];

const TR: Record<Lang, {
  drop: string; dropSub: string; presets: string; stampText: string;
  placement: string; placements: Record<StampPlacement, string>;
  font: string; style: string; bold: string; italic: string; borderBox: string;
  color: string; scale: string; opacity: string;
  apply: string; stamping: string; clear: string; failed: string;
}> = {
  en: {
    drop: 'Drop an image or click to browse',
    dropSub: 'Stamp a status mark onto an image · or paste (⌘V)',
    presets: 'Presets',
    stampText: 'Stamp text',
    placement: 'Placement',
    placements: {
      center: 'Center',
      'top-left': 'Top left',
      'top-right': 'Top right',
      'bottom-left': 'Bottom left',
      'bottom-right': 'Bottom right',
    },
    font: 'Font',
    style: 'Style',
    bold: 'Bold',
    italic: 'Italic',
    borderBox: 'Border box',
    color: 'Color',
    scale: 'Scale',
    opacity: 'Opacity',
    apply: 'Apply stamp',
    stamping: 'Stamping…',
    clear: 'Clear',
    failed: 'Stamp failed',
  },
  id: {
    drop: 'Letakkan gambar atau klik untuk telusuri',
    dropSub: 'Stempelkan tanda status ke gambar · atau tempel (⌘V)',
    presets: 'Preset',
    stampText: 'Teks stempel',
    placement: 'Penempatan',
    placements: {
      center: 'Tengah',
      'top-left': 'Kiri atas',
      'top-right': 'Kanan atas',
      'bottom-left': 'Kiri bawah',
      'bottom-right': 'Kanan bawah',
    },
    font: 'Font',
    style: 'Gaya',
    bold: 'Tebal',
    italic: 'Miring',
    borderBox: 'Kotak batas',
    color: 'Warna',
    scale: 'Skala',
    opacity: 'Opasitas',
    apply: 'Terapkan stempel',
    stamping: 'Menstempel…',
    clear: 'Bersihkan',
    failed: 'Gagal menstempel',
  },
};

export default function ImageStamp({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('CONFIDENTIAL');
  const [color, setColor] = useState('#c0392b');
  const [font, setFont] = useState<StampFont>('sans');
  const [bold, setBold] = useState(true);
  const [italic, setItalic] = useState(false);
  const [bordered, setBordered] = useState(true);
  const [placement, setPlacement] = useState<StampPlacement>('center');
  const [scale, setScale] = useState(40);
  const [opacity, setOpacity] = useState(85);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files.find(f => f.type.startsWith('image/')) ?? null);
    setResult(null);
    setError('');
  };

  usePasteImage(f => onDrop([f]));

  const applyPreset = (label: string, presetColor: string) => {
    setText(label.toUpperCase());
    setColor(presetColor);
    setResult(null);
  };

  const outName = file
    ? file.name.replace(/\.[^.]+$/, '') + '-stamped.' + keepFormat(file.type).ext
    : 'stamped.png';

  const run = async () => {
    if (!file || !text.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await stampImage(file, {
        text: text.trim(),
        color,
        bold,
        italic,
        font,
        bordered,
        placement,
        scale,
        opacity,
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

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.presets}
        </span>
        <div className="flex flex-wrap gap-2">
          {STAMP_PRESETS.map(p => (
            <Button key={p.label} variant="secondary" onClick={() => applyPreset(p.label, p.color)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.stampText}
        </span>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
        />
      </label>

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.placement}
        </span>
        <div className="flex flex-wrap gap-2">
          {PLACEMENTS.map(({ value }) => (
            <Button
              key={value}
              variant={placement === value ? 'primary' : 'secondary'}
              aria-pressed={placement === value}
              onClick={() => setPlacement(value)}
            >
              {t.placements[value]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t.font}
          </span>
          <div className="flex flex-wrap gap-2">
            {FONTS.map(({ value, label }) => (
              <Button
                key={value}
                variant={font === value ? 'primary' : 'secondary'}
                aria-pressed={font === value}
                onClick={() => setFont(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t.style}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant={bold ? 'primary' : 'secondary'} aria-pressed={bold} onClick={() => setBold(b => !b)}>
              {t.bold}
            </Button>
            <Button variant={italic ? 'primary' : 'secondary'} aria-pressed={italic} onClick={() => setItalic(i => !i)}>
              {t.italic}
            </Button>
            <Button variant={bordered ? 'primary' : 'secondary'} aria-pressed={bordered} onClick={() => setBordered(b => !b)}>
              {t.borderBox}
            </Button>
          </div>
        </div>

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

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex-1 space-y-1.5">
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
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || !text.trim() || busy}>
          {busy ? t.stamping : t.apply}
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
