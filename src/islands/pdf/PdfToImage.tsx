import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileArchive } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download.service';
import { openPdfRenderer, type PdfRenderer } from '@/tools/pdf/render.lib';

const WINDOW = 5;

const SCALES = [
  { scale: 1, label: '1×' },
  { scale: 2, label: '2×' },
  { scale: 3, label: '3×' },
];

const FORMATS = [
  { value: 'image/png', ext: 'png', label: 'PNG' },
  { value: 'image/jpeg', ext: 'jpg', label: 'JPG' },
];

interface Thumb {
  pageNumber: number;
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

export default function PdfToImage() {
  const rendererRef = useRef<PdfRenderer | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [scale, setScale] = useState(2);
  const [format, setFormat] = useState('image/png');
  const [pageCount, setPageCount] = useState(0);
  const [windowStart, setWindowStart] = useState(1);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [opening, setOpening] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  const ext = FORMATS.find(f => f.value === format)?.ext ?? 'png';
  const baseName = file ? file.name.replace(/\.pdf$/i, '') : 'page';

  const onDrop = async (files: File[]) => {
    const pdf = files[0];
    if (!pdf) return;
    setError('');
    rendererRef.current?.destroy();
    rendererRef.current = null;
    setThumbs([]);
    setPageCount(0);
    setWindowStart(1);
    setFile(pdf);
    setOpening(true);
    try {
      const data = await pdf.arrayBuffer();
      const renderer = await openPdfRenderer(data);
      rendererRef.current = renderer;
      setPageCount(renderer.pageCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open this PDF');
      setFile(null);
    } finally {
      setOpening(false);
    }
  };

  // Render the current window whenever it, the scale, or the format changes.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || pageCount === 0) return;
    let cancelled = false;
    setRendering(true);
    const start = windowStart;
    const end = Math.min(start + WINDOW - 1, pageCount);
    (async () => {
      const rendered: Thumb[] = [];
      try {
        for (let n = start; n <= end; n++) {
          const { blob, width, height } = await renderer.renderPage(n, scale, format);
          if (cancelled) break;
          rendered.push({ pageNumber: n, blob, url: URL.createObjectURL(blob), width, height });
        }
        if (cancelled) {
          rendered.forEach(t => URL.revokeObjectURL(t.url));
          return;
        }
        setThumbs(rendered);
      } catch {
        if (!cancelled) setError('Could not render pages');
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowStart, pageCount, scale, format]);

  useEffect(() => () => thumbs.forEach(t => URL.revokeObjectURL(t.url)), [thumbs]);
  useEffect(() => () => rendererRef.current?.destroy(), []);

  const downloadAllZip = async () => {
    const renderer = rendererRef.current;
    if (!renderer || pageCount === 0) return;
    setZipProgress(0);
    setError('');
    try {
      const files: { blob: Blob; filename: string }[] = [];
      for (let n = 1; n <= pageCount; n++) {
        const { blob } = await renderer.renderPage(n, scale, format);
        files.push({ blob, filename: `${baseName}-${n}.${ext}` });
        setZipProgress(Math.round((n / pageCount) * 100));
      }
      await downloadService.downloadZip(files, `${baseName}-images.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create ZIP');
    } finally {
      setZipProgress(null);
    }
  };

  const windowEnd = Math.min(windowStart + WINDOW - 1, pageCount);
  const busy = opening || zipProgress !== null;

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">Render each page to a PNG or JPG image</p>
        </div>
      </Dropzone>

      {opening && (
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Opening PDF… (first use loads the render engine)
        </p>
      )}

      {file && pageCount > 0 && (
        <>
          <p className="text-sm font-bold text-foreground">
            {file.name} — {pageCount} pages
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Scale
              </span>
              <div className="flex gap-2">
                {SCALES.map(({ scale: value, label }) => (
                  <Button
                    key={value}
                    variant={scale === value ? 'primary' : 'secondary'}
                    aria-pressed={scale === value}
                    onClick={() => setScale(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Format
              </span>
              <div className="flex gap-2">
                {FORMATS.map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={format === value ? 'primary' : 'secondary'}
                    aria-pressed={format === value}
                    onClick={() => setFormat(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Pages {windowStart}–{windowEnd} of {pageCount}
              {pageCount > WINDOW && (
                <span className="ml-2 inline-flex gap-1 align-middle">
                  <button
                    onClick={() => setWindowStart(s => Math.max(1, s - WINDOW))}
                    disabled={windowStart <= 1}
                    className="border-2 border-border bg-muted p-1 shadow-brutal-sm press-brutal disabled:opacity-30"
                    aria-label="Previous pages"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setWindowStart(s => Math.min(s + WINDOW, pageCount))}
                    disabled={windowEnd >= pageCount}
                    className="border-2 border-border bg-muted p-1 shadow-brutal-sm press-brutal disabled:opacity-30"
                    aria-label="Next pages"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </span>
              )}
            </span>
            <Button onClick={downloadAllZip} disabled={busy}>
              <FileArchive className="h-4 w-4" />
              {zipProgress !== null ? 'Zipping…' : `Download all (ZIP)`}
            </Button>
          </div>

          {zipProgress !== null && (
            <ProgressBar percent={zipProgress} label={`Rendering all ${pageCount} pages`} />
          )}
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {thumbs.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {thumbs.map(page => (
            <div
              key={page.pageNumber}
              className="space-y-2 border-2 border-border bg-muted p-2 shadow-brutal-sm"
            >
              <img src={page.url} alt={`Page ${page.pageNumber}`} className="w-full border-2 border-border" />
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-xs font-bold uppercase text-muted-foreground">
                  <span className="block">Page {page.pageNumber}</span>
                  <span className="block font-mono normal-case">
                    {page.width}×{page.height}
                  </span>
                </span>
                <button
                  onClick={() => downloadService.download(page.blob, `${baseName}-${page.pageNumber}.${ext}`)}
                  className="flex shrink-0 items-center gap-1 border-2 border-border bg-accent px-2 py-1 text-xs font-bold uppercase text-accent-foreground shadow-brutal-sm press-brutal"
                >
                  <Download className="h-3 w-3" /> {ext.toUpperCase()}
                </button>
              </div>
            </div>
          ))}
          {rendering && thumbs.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">Rendering…</p>
          )}
        </div>
      )}
    </div>
  );
}
