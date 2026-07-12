import { useEffect, useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { addWatermark, buildWatermarkPreview, type WatermarkLayout } from '@/tools/pdf/pdf.lib';

const LAYOUTS: { value: WatermarkLayout; label: string }[] = [
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'tiled', label: 'Tiled' },
  { value: 'horizontal', label: 'Horizontal' },
];

const SIZES = [
  { value: 1 / 20, label: 'Small' },
  { value: 1 / 14, label: 'Medium' },
  { value: 1 / 9, label: 'Large' },
];

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

export default function PdfWatermark() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('CONFIDENTIAL');
  const [layout, setLayout] = useState<WatermarkLayout>('diagonal');
  const [fontScale, setFontScale] = useState(1 / 14);
  const [opacity, setOpacity] = useState(25);
  const [color, setColor] = useState('#808080');
  const [result, setResult] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files[0] ?? null);
    setResult(null);
    setError('');
  };

  // Live page-1 preview, rebuilt (debounced) whenever the file or options change.
  useEffect(() => {
    if (!file || !text.trim()) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const bytes = await buildWatermarkPreview(file, text.trim(), {
          layout,
          fontScale,
          opacity: opacity / 100,
          color: hexToRgb01(color),
        });
        if (!cancelled) setPreview(bytes);
      } catch {
        if (!cancelled) setPreview(null);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [file, text, layout, fontScale, opacity, color]);

  const run = async () => {
    if (!file || !text.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(
        await addWatermark(file, text.trim(), {
          layout,
          fontScale,
          opacity: opacity / 100,
          color: hexToRgb01(color),
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Watermark failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">Stamp a text watermark on every page</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <TextArea
        label="Watermark text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="CONFIDENTIAL"
        rows={1}
      />

      <div className="space-y-1.5">
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
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
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
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
            min={5}
            max={60}
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

      {preview && <PdfPreview source={preview} label="Live preview" />}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || !text.trim() || busy}>
          {busy ? 'Stamping…' : 'Add watermark'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setPreview(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ResultActions blob={result} filename="watermarked.pdf" disabled={busy} />}
    </div>
  );
}
