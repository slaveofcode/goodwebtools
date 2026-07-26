import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { openPdfRenderer, type PdfRenderer } from '@/tools/pdf/render.lib';

const WINDOW = 5; // thumbnails shown per page of the preview

interface PdfPreviewProps {
  /** PDF bytes/blob to preview, or null to render nothing. */
  source: Blob | Uint8Array | null;
  scale?: number;
  label?: string;
}

interface Thumb {
  pageNumber: number;
  url: string;
}

/**
 * Paginated PDF preview: renders up to 5 page thumbnails at a time with
 * prev/next navigation. The pdf.js document stays open so paging is fast.
 */
export function PdfPreview({ source, scale = 1, label = 'Preview' }: PdfPreviewProps) {
  const rendererRef = useRef<PdfRenderer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [windowStart, setWindowStart] = useState(1);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoomed, setZoomed] = useState<Thumb | null>(null);

  // Open the document when the source changes.
  useEffect(() => {
    if (!source) {
      setPageCount(0);
      setThumbs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setWindowStart(1);
    setPageCount(0);
    (async () => {
      try {
        // Copy the bytes: pdf.js detaches the ArrayBuffer it's handed, which
        // would corrupt a Uint8Array the caller may reuse across renders.
        const data = source instanceof Blob ? await source.arrayBuffer() : source.slice();
        const renderer = await openPdfRenderer(data);
        if (cancelled) {
          renderer.destroy();
          return;
        }
        rendererRef.current?.destroy();
        rendererRef.current = renderer;
        setPageCount(renderer.pageCount);
      } catch {
        if (!cancelled) {
          setError('Could not render preview');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Render the current 5-page window whenever it changes.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || pageCount === 0) return;
    let cancelled = false;
    setLoading(true);
    const start = windowStart;
    const end = Math.min(start + WINDOW - 1, pageCount);
    (async () => {
      const rendered: Thumb[] = [];
      try {
        for (let n = start; n <= end; n++) {
          const { blob } = await renderer.renderPage(n, scale);
          if (cancelled) break;
          rendered.push({ pageNumber: n, url: URL.createObjectURL(blob) });
        }
        if (cancelled) {
          rendered.forEach(t => URL.revokeObjectURL(t.url));
          return;
        }
        setThumbs(rendered);
      } catch {
        if (!cancelled) setError('Could not render pages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowStart, pageCount, scale]);

  // Revoke the current window's object URLs when they change or on unmount.
  useEffect(() => {
    return () => thumbs.forEach(t => URL.revokeObjectURL(t.url));
  }, [thumbs]);

  // Close the zoom overlay when the page window changes (its URL may be gone).
  useEffect(() => {
    setZoomed(null);
  }, [thumbs]);

  // Escape closes the zoom overlay.
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoomed(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  // Tear down the renderer on unmount.
  useEffect(() => {
    return () => rendererRef.current?.destroy();
  }, []);

  if (!source) return null;

  const windowEnd = Math.min(windowStart + WINDOW - 1, pageCount);
  const canPrev = windowStart > 1;
  const canNext = windowEnd < pageCount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {label}
          {pageCount > 0 && (
            <span className="ml-1 normal-case">
              {' '}
              — {pageCount === 1 ? '1 page' : `pages ${windowStart}–${windowEnd} of ${pageCount}`}
            </span>
          )}
        </span>
        {pageCount > WINDOW && (
          <div className="flex gap-1">
            <button
              onClick={() => setWindowStart(s => Math.max(1, s - WINDOW))}
              disabled={!canPrev}
              className="border-2 border-border bg-muted p-1 shadow-brutal-sm press-brutal disabled:opacity-30"
              aria-label="Previous pages"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWindowStart(s => Math.min(s + WINDOW, pageCount))}
              disabled={!canNext}
              className="border-2 border-border bg-muted p-1 shadow-brutal-sm press-brutal disabled:opacity-30"
              aria-label="Next pages"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="border-2 border-border bg-muted p-2 shadow-brutal-sm">
        {thumbs.length === 0 && loading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Rendering preview…</p>
        )}
        {error && !loading && (
          <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {thumbs.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {thumbs.map(thumb => (
              <div key={thumb.pageNumber} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setZoomed(thumb)}
                  className="group relative block w-full border-2 border-border bg-white"
                  aria-label={`Zoom page ${thumb.pageNumber}`}
                >
                  <img src={thumb.url} alt={`Page ${thumb.pageNumber}`} className="w-full" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </span>
                </button>
                <p className="text-center text-xs font-bold text-muted-foreground">
                  Page {thumb.pageNumber}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoomed(null)}
        >
          <div className="relative max-h-full max-w-4xl overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wide text-white">
                Page {zoomed.pageNumber}
              </span>
              <button
                type="button"
                onClick={() => setZoomed(null)}
                className="border-2 border-white bg-white p-1 text-black shadow-brutal-sm"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={zoomed.url}
              alt={`Page ${zoomed.pageNumber}`}
              className="w-full border-2 border-white bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
