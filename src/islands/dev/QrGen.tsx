import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

type ErrorLevel = 'L' | 'M' | 'Q' | 'H';

export default function QrGen() {
  const [text, setText] = useState('https://goodwebtools.com');
  const [level, setLevel] = useState<ErrorLevel>('M');
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      { errorCorrectionLevel: level, width: 320, margin: 2 },
      err => setError(err ? 'Text too long for a QR code' : '')
    );
  }, [text, level]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'qrcode.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

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
        <Button onClick={download} disabled={!text || !!error}>Download PNG</Button>
      </div>
    </div>
  );
}
