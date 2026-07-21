import { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { downloadService } from '@/services/download';
import { canvasSupportsType } from '@/tools/image/encode.lib';

type ErrorLevel = 'L' | 'M' | 'Q' | 'H';

interface Format {
  key: string;
  label: string;
  ext: string;
  mime?: string; // raster formats
  svg?: boolean; // vector
  detect?: string; // feature-detect this mime before offering
}

const FORMATS: Format[] = [
  { key: 'png', label: 'PNG', ext: 'png', mime: 'image/png' },
  { key: 'jpeg', label: 'JPEG', ext: 'jpg', mime: 'image/jpeg' },
  { key: 'webp', label: 'WebP', ext: 'webp', mime: 'image/webp' },
  { key: 'avif', label: 'AVIF (AV1)', ext: 'avif', mime: 'image/avif', detect: 'image/avif' },
  { key: 'svg', label: 'SVG (vector)', ext: 'svg', svg: true },
];

const QR_WIDTH = 320;

export default function QrGen() {
  const [text, setText] = useState('https://goodwebtools.com');
  const [level, setLevel] = useState<ErrorLevel>('M');
  const [avifOk, setAvifOk] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    canvasSupportsType('image/avif').then(setAvifOk);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!text) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    QRCode.toCanvas(
      canvas,
      text,
      { errorCorrectionLevel: level, width: QR_WIDTH, margin: 2 },
      err => setError(err ? 'Text too long for a QR code' : '')
    );
  }, [text, level]);

  // Close the download menu when clicking outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  const available = FORMATS.filter(f => !f.detect || (f.detect === 'image/avif' && avifOk));
  const ready = !!text && !error;

  const downloadAs = async (fmt: Format) => {
    if (!ready) return;
    const name = `qrcode.${fmt.ext}`;
    if (fmt.svg) {
      const svg = await QRCode.toString(text, {
        type: 'svg',
        errorCorrectionLevel: level,
        margin: 2,
        width: QR_WIDTH,
      });
      await downloadService.download(new Blob([svg], { type: 'image/svg+xml' }), name);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, fmt.mime, fmt.mime === 'image/png' ? undefined : 0.95)
    );
    if (blob) await downloadService.download(blob, name);
  };

  const toPngBlob = () =>
    new Promise<Blob>((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error('No QR code yet.'));
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/png');
    });

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-muted-foreground">Text or URL</span>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-lg border border-border bg-muted/40 p-3 text-sm outline-none focus:border-accent"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-muted-foreground">Error correction</span>
          <select
            value={level}
            onChange={e => setLevel(e.target.value as ErrorLevel)}
            className="w-full rounded-lg border border-border bg-muted/40 p-2 text-sm outline-none focus:border-accent"
          >
            <option value="L">Low (~7%)</option>
            <option value="M">Medium (~15%)</option>
            <option value="Q">Quartile (~25%)</option>
            <option value="H">High (~30%)</option>
          </select>
        </label>

        {error && <Alert variant="error">{error}</Alert>}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="rounded-lg border border-border bg-white p-3">
          <canvas ref={canvasRef} className="block" />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {/* Download button with a format dropdown. */}
          <div className="relative" ref={menuRef}>
            <Button
              onClick={() => setMenuOpen(o => !o)}
              disabled={!ready}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Download className="h-4 w-4" />
              Download
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </Button>

            {menuOpen && ready && (
              <div
                role="menu"
                className="absolute left-0 top-full z-30 mt-2 min-w-full border-2 border-border bg-background shadow-brutal"
              >
                {available.map(f => (
                  <button
                    key={f.key}
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); downloadAs(f); }}
                    className="block w-full whitespace-nowrap px-4 py-2 text-left text-sm font-bold hover:bg-accent hover:text-accent-foreground"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <CopyImageButton blob={ready ? toPngBlob : null} disabled={!ready} />
        </div>
      </div>
    </div>
  );
}
