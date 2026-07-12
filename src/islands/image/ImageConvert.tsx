import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { processImage } from '@/tools/image/canvas.lib';

const FORMATS = [
  { mime: 'image/png', ext: 'png', label: 'PNG', lossy: false },
  { mime: 'image/jpeg', ext: 'jpg', label: 'JPEG', lossy: true },
  { mime: 'image/webp', ext: 'webp', label: 'WebP', lossy: true },
];

export default function ImageConvert() {
  const [file, setFile] = useState<File | null>(null);
  const [mime, setMime] = useState('image/png');
  const [quality, setQuality] = useState(90);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fmt = FORMATS.find(f => f.mime === mime)!;
  const outName = file ? file.name.replace(/\.[^.]+$/, '') + '.' + fmt.ext : `image.${fmt.ext}`;

  const onDrop = (files: File[]) => {
    setFile(files.find(f => f.type.startsWith('image/')) ?? null);
    setResult(null);
    setError('');
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await processImage(file, {
        mimeType: mime,
        quality: fmt.lossy ? quality / 100 : undefined,
      });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">Convert between PNG, JPEG, and WebP</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Output format
        </span>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(({ mime: value, label }) => (
            <Button
              key={value}
              variant={mime === value ? 'primary' : 'secondary'}
              aria-pressed={mime === value}
              onClick={() => setMime(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {fmt.lossy && (
        <label className="block space-y-1.5">
          <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span>Quality</span>
            <span>{quality}%</span>
          </span>
          <input
            type="range"
            min={10}
            max={100}
            value={quality}
            onChange={e => setQuality(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? 'Converting…' : `Convert to ${fmt.label}`}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} originalSize={file?.size} />}
    </div>
  );
}
