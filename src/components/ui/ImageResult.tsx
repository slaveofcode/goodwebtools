import { useEffect, useState } from 'react';
import { ResultActions } from './ResultActions';
import { formatBytes } from '@/tools/image/canvas.lib';

interface ImageResultProps {
  blob: Blob;
  filename: string;
  /** Original file size, to show the size delta. */
  originalSize?: number;
}

/** Shows an image result: preview, output size (and % change), download. */
export function ImageResult({ blob, filename, originalSize }: ImageResultProps) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  const reduction =
    originalSize && originalSize > 0 ? Math.round((1 - blob.size / originalSize) * 100) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-bold uppercase tracking-wide text-muted-foreground">Result</span>
        <span className="font-mono">{formatBytes(blob.size)}</span>
        {reduction !== null && (
          <span
            className={
              reduction >= 0
                ? 'font-bold text-green-600 dark:text-green-400'
                : 'font-bold text-red-600 dark:text-red-400'
            }
          >
            {reduction >= 0 ? `−${reduction}% smaller` : `+${-reduction}% larger`}
          </span>
        )}
      </div>
      {url && (
        <img
          src={url}
          alt="Result preview"
          className="max-h-[28rem] w-auto border-2 border-border bg-white"
        />
      )}
      <ResultActions blob={blob} filename={filename} />
    </div>
  );
}
