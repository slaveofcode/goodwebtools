import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { watermarkImage, keepFormat, type WatermarkLayout } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

const LAYOUTS: { value: WatermarkLayout; label: string }[] = [
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'tiled', label: 'Tiled' },
  { value: 'bottom-right', label: 'Corner' },
];

const SIZES = [
  { value: 1 / 16, label: 'Small' },
  { value: 1 / 10, label: 'Medium' },
  { value: 1 / 6, label: 'Large' },
];

export default function ImageWatermark() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('© GoodWebTools');
  const [layout, setLayout] = useState<WatermarkLayout>('diagonal');
  const [fontScale, setFontScale] = useState(1 / 10);
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
        fontScale,
        opacity: opacity / 100,
        color,
      });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Watermark failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">Stamp a text watermark onto an image · or paste (⌘V)</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <label className="block space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Watermark text
        </span>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
        />
      </label>

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Layout
        </span>
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map(({ value, label }) => (
            <Button
              key={value}
              variant={layout === value ? 'primary' : 'secondary'}
              aria-pressed={layout === value}
              onClick={() => setLayout(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Size
        </span>
        <div className="flex flex-wrap gap-2">
          {SIZES.map(({ value, label }) => (
            <Button
              key={label}
              variant={fontScale === value ? 'primary' : 'secondary'}
              aria-pressed={fontScale === value}
              onClick={() => setFontScale(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex-1 space-y-1.5">
          <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span>Opacity</span>
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
            Color
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
          {busy ? 'Stamping…' : 'Add watermark'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} />}
    </div>
  );
}
