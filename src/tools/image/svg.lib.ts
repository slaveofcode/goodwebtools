export interface RasterizeOpts {
  scale?: number;
  width?: number;
  height?: number;
  type: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  background?: string;
}

const num = (s: string | null): number | null => {
  if (!s) return null;
  const m = s.match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : null;
};

/** Read an SVG's intrinsic size from width/height, else viewBox, else 300x150. */
export function parseSvgSize(markup: string): {
  width: number;
  height: number;
  viewBox?: [number, number, number, number];
} {
  const w = num(markup.match(/\bwidth\s*=\s*["']([^"']+)["']/)?.[1] ?? null);
  const h = num(markup.match(/\bheight\s*=\s*["']([^"']+)["']/)?.[1] ?? null);
  const vbRaw = markup.match(/\bviewBox\s*=\s*["']([^"']+)["']/)?.[1];
  let viewBox: [number, number, number, number] | undefined;
  if (vbRaw) {
    const parts = vbRaw.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      viewBox = [parts[0], parts[1], parts[2], parts[3]];
    }
  }
  const width = w ?? viewBox?.[2] ?? 300;
  const height = h ?? viewBox?.[3] ?? 150;
  return { width, height, viewBox };
}

/** Rasterize SVG markup to a PNG/JPEG/WebP blob at a scale or explicit size. */
export function rasterizeSvg(markup: string, opts: RasterizeOpts): Promise<Blob> {
  const { width: iw, height: ih } = parseSvgSize(markup);
  const targetW = Math.max(1, Math.round(opts.width ?? iw * (opts.scale ?? 1)));
  const targetH = Math.max(1, Math.round(opts.height ?? ih * (opts.scale ?? 1)));
  const svgBlob = new Blob([markup], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is not supported in this browser'));
      if (opts.type === 'image/jpeg' || opts.background) {
        ctx.fillStyle = opts.background ?? '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), opts.type, opts.quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't render this SVG."));
    };
    img.src = url;
  });
}
