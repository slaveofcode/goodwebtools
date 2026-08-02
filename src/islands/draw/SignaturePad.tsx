import { useEffect, useRef, useState } from 'react';
import { Download, Eraser } from 'lucide-react';
import SignaturePadLib from 'signature_pad';
import { Button } from '@/components/ui/Button';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { EditInAnnotatorButton } from '@/components/ui/EditInAnnotatorButton';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  penColor: string;
  pen: string;
  width: string;
  transparentBg: string;
  hint: string;
  downloadPng: string;
  downloadSvg: string;
  clear: string;
}> = {
  en: {
    penColor: 'Pen color',
    pen: 'Pen',
    width: 'Width',
    transparentBg: 'Transparent background',
    hint: 'Sign with a mouse, trackpad, or finger. Everything stays in your browser.',
    downloadPng: 'Download PNG',
    downloadSvg: 'Download SVG',
    clear: 'Clear',
  },
  id: {
    penColor: 'Warna pena',
    pen: 'Pena',
    width: 'Lebar',
    transparentBg: 'Latar transparan',
    hint: 'Tanda tangani dengan mouse, trackpad, atau jari. Semuanya tetap di browser Anda.',
    downloadPng: 'Unduh PNG',
    downloadSvg: 'Unduh SVG',
    clear: 'Bersihkan',
  },
};

export default function SignaturePad({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [color, setColor] = useState('#0a0a0a');
  const [width, setWidth] = useState(3);
  const [transparent, setTransparent] = useState(true);
  const [empty, setEmpty] = useState(true);

  // Set up the pad once, sized for the device pixel ratio so strokes are crisp.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    const pad = new SignaturePadLib(canvas, { penColor: color, minWidth: width * 0.5, maxWidth: width });
    pad.addEventListener('endStroke', () => setEmpty(pad.isEmpty()));
    padRef.current = pad;
    return () => pad.off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-update pen settings without recreating (keeps the drawing).
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    pad.penColor = color;
    pad.minWidth = width * 0.5;
    pad.maxWidth = width;
  }, [color, width]);

  const clear = () => {
    padRef.current?.clear();
    setEmpty(true);
  };

  const toPngBlob = async (): Promise<Blob> => {
    const canvas = canvasRef.current!;
    if (transparent) {
      return await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/png')
      );
    }
    // Flatten onto white.
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    return await new Promise<Blob>((res, rej) =>
      out.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/png')
    );
  };

  const downloadPng = async () => {
    if (empty) return;
    await downloadService.download(await toPngBlob(), 'signature.png');
  };

  const downloadSvg = () => {
    const pad = padRef.current;
    if (!pad || empty) return;
    const svg = pad.toSVG();
    downloadService.download(new Blob([svg], { type: 'image/svg+xml' }), 'signature.svg');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm" title={t.penColor}>
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.pen}</span>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-10 cursor-pointer border-2 border-border bg-muted" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t.width}</span>
          <input type="range" min={1} max={8} value={width} onChange={e => setWidth(Number(e.target.value))} className="w-24 accent-accent" />
        </label>
        <label className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-3 py-1.5 text-sm">
          <input type="checkbox" checked={transparent} onChange={() => setTransparent(t => !t)} className="accent-accent" />
          {t.transparentBg}
        </label>
      </div>

      <div className={`inline-block w-full max-w-2xl border-2 border-border ${transparent ? 'gwt-checkerboard' : 'bg-white'}`}>
        <canvas ref={canvasRef} className="block h-64 w-full touch-none" style={{ cursor: 'crosshair' }} />
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={downloadPng} disabled={empty}>
          <Download className="h-4 w-4" />
          {t.downloadPng}
        </Button>
        <Button variant="secondary" onClick={downloadSvg} disabled={empty}>
          <Download className="h-4 w-4" />
          {t.downloadSvg}
        </Button>
        <CopyImageButton blob={empty ? null : toPngBlob} disabled={empty} />
        <EditInAnnotatorButton blob={empty ? null : toPngBlob} filename="signature.png" disabled={empty} />
        <Button variant="ghost" onClick={clear} disabled={empty}>
          <Eraser className="h-4 w-4" />
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
