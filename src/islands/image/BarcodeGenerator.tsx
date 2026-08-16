import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { BARCODE_FORMATS, validateValue } from '@/tools/image/barcode.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Generate a barcode — Code 128, EAN-13, UPC, Code 39 and more — and download it as PNG or SVG. Everything is rendered in your browser; nothing is uploaded.',
    format: 'Format', value: 'Value', showText: 'Show text', png: 'Download PNG', svg: 'Download SVG',
  },
  id: {
    intro: 'Buat barcode — Code 128, EAN-13, UPC, Code 39, dan lainnya — lalu unduh sebagai PNG atau SVG. Semuanya dirender di browser Anda; tidak ada yang diunggah.',
    format: 'Format', value: 'Nilai', showText: 'Tampilkan teks', png: 'Unduh PNG', svg: 'Unduh SVG',
  },
};

export default function BarcodeGenerator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [format, setFormat] = useState('CODE128');
  const [value, setValue] = useState('GOODWEBTOOLS');
  const [showText, setShowText] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hint = BARCODE_FORMATS.find(f => f.id === format)?.hint ?? '';

  useEffect(() => {
    let cancelled = false;
    const err = validateValue(format, value);
    if (err) {
      setError(err);
      const c = canvasRef.current;
      if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
      return;
    }
    setError(null);
    (async () => {
      const JsBarcode = (await import('jsbarcode')).default;
      if (cancelled || !canvasRef.current) return;
      try {
        JsBarcode(canvasRef.current, value, {
          format,
          displayValue: showText,
          width: 2,
          height: 90,
          margin: 12,
          background: '#ffffff',
          lineColor: '#000000',
          font: 'monospace',
          fontSize: 16,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not render this barcode.');
      }
    })();
    return () => { cancelled = true; };
  }, [format, value, showText]);

  const downloadPng = () => {
    canvasRef.current?.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barcode-${format}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const downloadSvg = async () => {
    const JsBarcode = (await import('jsbarcode')).default;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(svg, value, { format, displayValue: showText, width: 2, height: 90, margin: 12, font: 'monospace', fontSize: 16 });
    } catch {
      return;
    }
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barcode-${format}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const input = 'w-full border-2 border-border bg-muted p-2 text-sm';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.format}</span>
          <select value={format} onChange={e => setFormat(e.target.value)} className={input}>
            {BARCODE_FORMATS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.value}</span>
          <input value={value} onChange={e => setValue(e.target.value)} className={input} />
          <span className="text-xs text-muted-foreground">{hint}</span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} />
        <span>{t.showText}</span>
      </label>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex justify-center border-2 border-border bg-white p-4">
        <canvas ref={canvasRef} className={error ? 'hidden' : 'max-w-full'} />
      </div>

      {!error && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadPng}>{t.png}</Button>
          <Button variant="secondary" onClick={downloadSvg}>{t.svg}</Button>
        </div>
      )}
    </div>
  );
}
