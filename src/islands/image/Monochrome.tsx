import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { applyMono, type MonoMode } from '@/tools/image/mono.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

const MODES: { key: MonoMode; label: string; note: string }[] = [
  { key: 'grayscale', label: 'Grayscale', note: 'Luminance desaturation.' },
  { key: 'bw', label: 'Black & White', note: 'Hard threshold to pure black/white.' },
  { key: 'dither', label: 'Dithered B/W', note: 'Floyd–Steinberg dithering for smoother tone.' },
];

export default function Monochrome() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<MonoMode>('grayscale');
  const [threshold, setThreshold] = useState(128);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files.find((f) => f.type.startsWith('image/')) ?? null);
    setResult(null);
    setError('');
  };
  usePasteImage((f) => onDrop([f]));

  // Re-run whenever the input, mode, or threshold changes (debounced).
  useEffect(() => {
    if (!file) return;
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      applyMono(file, { mode, threshold })
        .then((b) => alive && setResult(b))
        .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed'))
        .finally(() => alive && setBusy(false));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [file, mode, threshold]);

  const outName = file ? file.name.replace(/\.[^.]+$/, '') + `-${mode}.png` : 'image.png';

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">Grayscale, black &amp; white, or dithered · or paste (⌘V)</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Mode</span>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Button key={m.key} variant={mode === m.key ? 'primary' : 'secondary'} aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>
              {m.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{MODES.find((m) => m.key === mode)?.note}</p>
      </div>

      {mode === 'bw' && (
        <label className="block space-y-1.5">
          <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span>Threshold</span>
            <span>{threshold}</span>
          </span>
          <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-accent" />
        </label>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} originalSize={file?.size} />}
      {busy && <p className="text-sm text-muted-foreground">Processing…</p>}
    </div>
  );
}
