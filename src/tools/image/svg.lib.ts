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

/**
 * Prepare SVG markup for rasterization: ensure the SVG namespace is present and
 * force concrete width/height on the root <svg>. Without explicit pixel sizes a
 * viewBox-only or percentage-sized SVG loads as an <img> at 0×0, so drawImage
 * paints nothing and the export comes out blank.
 */
function prepareForRaster(markup: string, w: number, h: number): string {
  const withNs = /<svg\b[^>]*\sxmlns\s*=/.test(markup)
    ? markup
    : markup.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  return withNs.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
    const stripped = attrs.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
    return `<svg${stripped} width="${w}" height="${h}">`;
  });
}

/** Rasterize SVG markup to a PNG/JPEG/WebP blob at a scale or explicit size. */
export function rasterizeSvg(markup: string, opts: RasterizeOpts): Promise<Blob> {
  const { width: iw, height: ih } = parseSvgSize(markup);
  const targetW = Math.max(1, Math.round(opts.width ?? iw * (opts.scale ?? 1)));
  const targetH = Math.max(1, Math.round(opts.height ?? ih * (opts.scale ?? 1)));
  // Load the SVG via a data URL, not a blob: URL. A blob: URL taints the canvas
  // in Chrome/WebKit, which makes toBlob() fail on export ("Failed to encode
  // image"); a data URL keeps the canvas origin-clean. Force the SVG to the
  // target size so it always renders at concrete dimensions.
  const dataUrl =
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(prepareForRaster(markup, targetW, targetH));

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
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
      try {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
          opts.type,
          opts.quality,
        );
      } catch (e) {
        // Tainted-canvas SecurityError or unsupported type.
        reject(e instanceof Error ? e : new Error('Failed to encode image'));
      }
    };
    img.onerror = () => reject(new Error("Couldn't render this SVG."));
    img.src = dataUrl;
  });
}
