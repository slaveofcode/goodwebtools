import { useState } from 'react';
import jsQR from 'jsqr';
import { Dropzone } from '@/components/ui/Dropzone';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';

async function decodeImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, imageData.width, imageData.height);
  return result?.data ?? null;
}

export default function QrRead() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleFile = async (files: File[]) => {
    setError('');
    setValue('');
    if (files.length === 0) return;
    try {
      const decoded = await decodeImage(files[0]);
      if (decoded) {
        setValue(decoded);
      } else {
        setError('No QR code found in this image.');
      }
    } catch {
      setError('Could not read the image file.');
    }
  };

  const isUrl = /^https?:\/\//i.test(value);

  return (
    <div className="space-y-4">
      <Dropzone onDrop={handleFile} accept="image/*" multiple={false}>
        <div className="space-y-2">
          <p className="text-lg">Drop a QR image or click to browse</p>
          <p className="text-sm text-muted-foreground">Decoded entirely in your browser</p>
        </div>
      </Dropzone>

      {error && <Alert variant="error">{error}</Alert>}

      {value && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Decoded content</span>
            <CopyButton value={value} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm break-all">
            {isUrl ? (
              <a href={value} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                {value}
              </a>
            ) : (
              <code>{value}</code>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
