import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

export default function PortraitBlur() {
  const [file, setFile] = useState<File | null>(null);
  const [strength, setStrength] = useState(16);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  // Cache the subject cutout so re-blurring at a new strength is instant.
  const cutoutRef = useRef<{ cutout: ImageBitmap; original: ImageBitmap } | null>(null);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const composite = (original: ImageBitmap, cutout: ImageBitmap, blurPx: number): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = original.width;
    canvas.height = original.height;
    const ctx = canvas.getContext('2d')!;
    // Blurred background from the original…
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(original, 0, 0);
    ctx.filter = 'none';
    // …then the sharp subject on top.
    ctx.drawImage(cutout, 0, 0);
    return new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/png')
    );
  };

  const setOut = (blob: Blob) => {
    setResult(blob);
    setResultUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  };

  const run = async (target: File, blurPx: number) => {
    setFile(target);
    setResult(null);
    setError('');
    setBusy(true);
    setPercent(0);
    setStage('Preparing…');
    try {
      const original = await createImageBitmap(target);
      setStage('Finding the subject…');
      const { removeBackground } = await import('@imgly/background-removal');
      const cutoutBlob = await removeBackground(target, {
        publicPath: new URL('/models/imgly/', location.origin).href,
        output: { format: 'image/png' },
        progress: (key, current, total) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          setPercent(pct);
          setStage(key.startsWith('fetch') ? 'Downloading AI model…' : 'Finding the subject…');
        },
      });
      const cutout = await createImageBitmap(cutoutBlob);
      cutoutRef.current = { cutout, original };
      setStage('Blurring background…');
      setOut(await composite(original, cutout, blurPx));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process this image.');
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const onDrop = (files: File[]) => {
    const image = files.find(f => f.type.startsWith('image/'));
    if (image) run(image, strength);
  };

  usePasteImage(f => onDrop([f]));

  // Re-blur instantly using the cached cutout when the slider changes.
  const changeStrength = async (value: number) => {
    setStrength(value);
    const cached = cutoutRef.current;
    if (cached && !busy) setOut(await composite(cached.original, cached.cutout, value));
  };

  const download = () => {
    if (!result || !file) return;
    downloadService.download(result, file.name.replace(/\.[^.]+$/, '') + '-portrait.png');
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a photo or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Keeps the subject sharp and blurs the background (portrait mode) · or paste (⌘V)
          </p>
        </div>
      </Dropzone>

      <label className="block space-y-1.5">
        <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <span>Background blur</span>
          <span>{strength}px</span>
        </span>
        <input
          type="range"
          min={2}
          max={40}
          value={strength}
          onChange={e => changeStrength(Number(e.target.value))}
          disabled={busy}
          className="w-full max-w-md accent-accent"
        />
      </label>

      <p className="text-xs text-muted-foreground">
        Runs entirely in your browser — the photo never leaves your device. Uses the same on-device
        AI as the Background Remover to isolate the subject; the model downloads once, then caches.
      </p>

      {busy && <ProgressBar percent={percent} label={stage || 'Working…'} />}
      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Result</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          <img src={resultUrl} alt="Portrait blur" className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
            <CopyImageButton blob={result} />
          </div>
        </div>
      )}
    </div>
  );
}
