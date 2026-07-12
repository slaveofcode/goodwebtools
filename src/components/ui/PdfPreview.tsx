import { useEffect, useState } from 'react';
import { renderFirstPage } from '@/tools/pdf/render.lib';

interface PdfPreviewProps {
  /** PDF bytes/blob to preview, or null to render nothing. */
  source: Blob | Uint8Array | null;
  scale?: number;
  label?: string;
}

/**
 * Renders page 1 of a PDF as an image preview. Re-renders whenever `source`
 * changes; object URLs are revoked on change/unmount.
 */
export function PdfPreview({ source, scale = 1.2, label = 'Preview' }: PdfPreviewProps) {
  const [url, setUrl] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!source) {
      setUrl('');
      setPageCount(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = source instanceof Blob ? await source.arrayBuffer() : source;
        const rendered = await renderFirstPage(data, scale);
        if (cancelled) return;
        setPageCount(rendered.pageCount);
        setUrl(URL.createObjectURL(rendered.blob));
      } catch {
        if (!cancelled) setError('Could not render preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, scale]);

  // Revoke the current object URL when it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (!source) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {label}
        {pageCount > 0 && <span className="ml-1 normal-case"> — page 1 of {pageCount}</span>}
      </span>
      <div className="border-2 border-border bg-muted p-2 shadow-brutal-sm">
        {loading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Rendering preview…</p>
        )}
        {error && !loading && (
          <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {url && !loading && !error && (
          <img
            src={url}
            alt="PDF page 1 preview"
            className="mx-auto max-h-[36rem] w-auto border-2 border-border bg-white"
          />
        )}
      </div>
    </div>
  );
}
