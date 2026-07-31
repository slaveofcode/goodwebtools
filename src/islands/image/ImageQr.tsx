import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { keepFormat } from '@/tools/image/canvas.lib';
import { overlayQr, type QrCorner } from '@/tools/image/qr-overlay.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

const CORNERS: { value: QrCorner; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
];

export default function ImageQr() {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('https://goodwebtools.com');
  const [corner, setCorner] = useState<QrCorner>('bottom-right');
  const [sizePercent, setSizePercent] = useState(18);
  const [card, setCard] = useState(true);
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
    ? file.name.replace(/\.[^.]+$/, '') + '-qr.' + keepFormat(file.type).ext
    : 'image-qr.png';

  const run = async () => {
    if (!file || !content.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await overlayQr(file, {
        content: content.trim(),
        corner,
        sizePercent,
        card,
      });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the QR code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">Add a QR code to a corner of an image · or paste (⌘V)</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <label className="block space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          QR content (text or URL)
        </span>
        <input
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
        />
      </label>

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Corner
        </span>
        <div className="flex flex-wrap gap-2">
          {CORNERS.map(({ value, label }) => (
            <Button
              key={value}
              variant={corner === value ? 'primary' : 'secondary'}
              aria-pressed={corner === value}
              onClick={() => setCorner(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex-1 space-y-1.5">
          <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span>Size</span>
            <span>{sizePercent}%</span>
          </span>
          <input
            type="range"
            min={1}
            max={100}
            value={sizePercent}
            onChange={e => setSizePercent(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </label>
        <div className="space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Backing
          </span>
          <Button variant={card ? 'primary' : 'secondary'} aria-pressed={card} onClick={() => setCard(c => !c)}>
            White card
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || !content.trim() || busy}>
          {busy ? 'Adding…' : 'Add QR'}
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
