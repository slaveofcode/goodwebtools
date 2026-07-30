import { toGrayscale, toBlackWhite } from './mono.lib';

export interface OcrBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function emptyLike(width: number, height: number): ImageData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: 'srgb' } as ImageData;
}

/** Grayscale; if a threshold is supplied, hard-binarize to black/white. */
export function applyCleanup(src: ImageData, opts: { threshold?: number } = {}): ImageData {
  const gray = toGrayscale(src);
  return opts.threshold === undefined ? gray : toBlackWhite(gray, opts.threshold);
}

/** One 90° clockwise rotation. dest[x'=h-1-y, y'=x]. */
export function rotate90(src: ImageData): ImageData {
  const { width: w, height: h } = src;
  const out = emptyLike(h, w); // dimensions swap
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const dx = h - 1 - y;
      const dy = x;
      const di = (dy * h + dx) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

/** Copy a sub-rectangle, clamped to the source bounds. */
export function crop(src: ImageData, region: OcrBox): ImageData {
  const x0 = Math.max(0, Math.min(region.x, src.width));
  const y0 = Math.max(0, Math.min(region.y, src.height));
  const x1 = Math.max(x0, Math.min(region.x + region.width, src.width));
  const y1 = Math.max(y0, Math.min(region.y + region.height, src.height));
  const w = x1 - x0;
  const h = y1 - y0;
  const out = emptyLike(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * src.width + (x0 + x)) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}
