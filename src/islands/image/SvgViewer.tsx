import { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { ZoomPane } from '@/components/ui/ZoomPane';
import { parseSvgSize, rasterizeSvg } from '@/tools/image/svg.lib';

const FORMATS = [
  { key: 'png', type: 'image/png' as const, label: 'PNG', lossy: false },
  { key: 'jpeg', type: 'image/jpeg' as const, label: 'JPEG', lossy: true },
  { key: 'webp', type: 'image/webp' as const, label: 'WebP', lossy: true },
];

export default function SvgViewer() {
  const [markup, setMarkup] = useState('');
  const [fmt, setFmt] = useState('png');
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState(92);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const f = files.find((x) => x.type === 'image/svg+xml' || x.name.toLowerCase().endsWith('.svg'));
    if (!f) { setError('Please drop an SVG file.'); return; }
    setError('');
    setResult(null);
    setMarkup(await f.text());
  };

  const clean = useMemo(
    () => (markup ? DOMPurify.sanitize(markup, { USE_PROFILES: { svg: true, svgFilters: true } }) : ''),
    [markup],
  );
  const size = useMemo(() => (markup ? parseSvgSize(markup) : null), [markup]);
  const format = FORMATS.find((f) => f.key === fmt)!;

  const convert = async () => {
    setError('');
    setResult(null);
    try {
      setResult(await rasterizeSvg(clean, { type: format.type, scale, quality: format.lossy ? quality / 100 : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rasterize failed');
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/svg+xml,.svg" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an SVG or click to browse</p>
          <p className="text-sm text-muted-foreground">View it, then export to PNG, JPEG, or WebP</p>
        </div>
      </Dropzone>

      <textarea
        value={markup}
        onChange={(e) => { setMarkup(e.target.value); setResult(null); }}
        placeholder="…or paste SVG markup here"
        className="h-32 w-full border-2 border-border bg-background p-2 font-mono text-xs"
      />

      {error && <Alert variant="error">{error}</Alert>}

      {clean && (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-mono">{size?.width} × {size?.height}</span>
            {size?.viewBox && <span className="font-mono text-muted-foreground">viewBox: {size.viewBox.join(' ')}</span>}
          </div>
          <ZoomPane>
            <div dangerouslySetInnerHTML={{ __html: clean }} />
          </ZoomPane>

          <div className="space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Export format</span>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <Button key={f.key} variant={fmt === f.key ? 'primary' : 'secondary'} aria-pressed={fmt === f.key} onClick={() => setFmt(f.key)}>{f.label}</Button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground"><span>Scale</span><span>{scale}×</span></span>
            <input type="range" min={1} max={8} step={1} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full accent-accent" />
          </label>

          {format.lossy && (
            <label className="block space-y-1.5">
              <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground"><span>Quality</span><span>{quality}%</span></span>
              <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-accent" />
            </label>
          )}

          <Button onClick={convert}>Export {format.label}</Button>
        </>
      )}

      {result && <ImageResult blob={result} filename={`image.${fmt === 'jpeg' ? 'jpg' : fmt}`} />}
    </div>
  );
}
