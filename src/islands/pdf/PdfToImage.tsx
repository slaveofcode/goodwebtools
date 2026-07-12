import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download.service';
import { renderPdfToImages, type RenderedPage } from '@/tools/pdf/render.lib';

interface PagePreview extends RenderedPage {
  url: string;
}

const SCALES = [
  { scale: 1, label: '1× (screen)' },
  { scale: 2, label: '2× (retina)' },
  { scale: 3, label: '3× (print)' },
];

export default function PdfToImage() {
  const [file, setFile] = useState<File | null>(null);
  const [scale, setScale] = useState(2);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Revoke object URLs when they change or on unmount.
  useEffect(() => {
    return () => pages.forEach(page => URL.revokeObjectURL(page.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  const clearPages = () => setPages([]);

  const onDrop = (files: File[]) => {
    setFile(files[0] ?? null);
    clearPages();
    setError('');
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    clearPages();
    setProgress(0);
    try {
      const rendered = await renderPdfToImages(file, scale, (done, total) =>
        setProgress(Math.round((done / total) * 100))
      );
      setPages(rendered.map(page => ({ ...page, url: URL.createObjectURL(page.blob) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not render this PDF');
    } finally {
      setBusy(false);
    }
  };

  const baseName = file ? file.name.replace(/\.pdf$/i, '') : 'page';

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">Render each page to a PNG image</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <div className="flex flex-wrap gap-2">
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

      <div className="flex flex-wrap gap-2">
        <Button onClick={convert} disabled={!file || busy}>
          {busy ? 'Rendering…' : 'Convert to images'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); clearPages(); setError(''); }}>
          Clear
        </Button>
      </div>

      {busy && <ProgressBar percent={progress} label="Rendering pages" />}
      {error && <Alert variant="error">{error}</Alert>}

      {pages.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {pages.map(page => (
            <div key={page.pageNumber} className="space-y-2 border-2 border-border bg-muted p-2 shadow-brutal-sm">
              <img
                src={page.url}
                alt={`Page ${page.pageNumber}`}
                className="w-full border-2 border-border"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-xs font-bold uppercase text-muted-foreground">
                  <span className="block">Page {page.pageNumber}</span>
                  <span className="block font-mono normal-case text-muted-foreground">
                    {page.width}×{page.height}
                  </span>
                </span>
                <button
                  onClick={() => downloadService.download(page.blob, `${baseName}-${page.pageNumber}.png`)}
                  className="flex shrink-0 items-center gap-1 border-2 border-border bg-accent px-2 py-1 text-xs font-bold uppercase text-accent-foreground shadow-brutal-sm press-brutal"
                >
                  <Download className="h-3 w-3" /> PNG
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
