import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { processImage, formatBytes } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

function outputFormat(type: string): { mime: string; ext: string; quality?: number } {
  if (type === 'image/jpeg') return { mime: 'image/jpeg', ext: 'jpg', quality: 0.95 };
  if (type === 'image/webp') return { mime: 'image/webp', ext: 'webp', quality: 0.95 };
  return { mime: 'image/png', ext: 'png' };
}

export default function ImageScrub() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files.find(f => f.type.startsWith('image/')) ?? null);
    setResult(null);
    setError('');
  };

  usePasteImage(f => onDrop([f]));

  const fmt = outputFormat(file?.type ?? '');
  const outName = file ? file.name.replace(/\.[^.]+$/, '') + '-clean.' + fmt.ext : `clean.${fmt.ext}`;

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await processImage(file, { mimeType: fmt.mime, quality: fmt.quality });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process this image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Strip EXIF, GPS location, and all other metadata · or paste (⌘V)
          </p>
        </div>
      </Dropzone>

      {file && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Re-encoding the image in your browser removes camera info, GPS coordinates, timestamps, and
        any other embedded metadata. Nothing is uploaded.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? 'Cleaning…' : 'Remove metadata'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <>
          <Alert variant="success">Metadata removed — this copy contains no EXIF or GPS data.</Alert>
          <ImageResult blob={result} filename={outName} originalSize={file?.size} />
        </>
      )}
    </div>
  );
}
