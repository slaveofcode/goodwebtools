export type MonoMode = 'grayscale' | 'bw' | 'dither';

const LUM = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

function cloneShape(src: ImageData): ImageData {
  return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data.length), colorSpace: 'srgb' } as ImageData;
}

/** Desaturate to luminance grey; alpha preserved. */
export function toGrayscale(src: ImageData): ImageData {
  const out = cloneShape(src);
  for (let i = 0; i < src.data.length; i += 4) {
    const y = Math.round(LUM(src.data[i], src.data[i + 1], src.data[i + 2]));
    out.data[i] = out.data[i + 1] = out.data[i + 2] = y;
    out.data[i + 3] = src.data[i + 3];
  }
  return out;
}

/** Hard threshold to pure black/white; alpha preserved. */
export function toBlackWhite(src: ImageData, threshold: number): ImageData {
  const out = cloneShape(src);
  for (let i = 0; i < src.data.length; i += 4) {
    const v = LUM(src.data[i], src.data[i + 1], src.data[i + 2]) >= threshold ? 255 : 0;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
    out.data[i + 3] = src.data[i + 3];
  }
  return out;
}

/** Floyd–Steinberg error-diffusion dither to 1-bit black/white. */
export function toDitheredBW(src: ImageData): ImageData {
  const { width, height } = src;
  const out = cloneShape(src);
  // Working luminance buffer (float) so error can accumulate.
  const lum = new Float32Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    lum[p] = LUM(src.data[i], src.data[i + 1], src.data[i + 2]);
    out.data[i + 3] = src.data[i + 3];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const old = lum[p];
      const nv = old >= 128 ? 255 : 0;
      const err = old - nv;
      const i = p * 4;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = nv;
      // Distribute error to neighbours (right, below-left, below, below-right).
      if (x + 1 < width) lum[p + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) lum[p + width - 1] += (err * 3) / 16;
        lum[p + width] += (err * 5) / 16;
        if (x + 1 < width) lum[p + width + 1] += (err * 1) / 16;
      }
    }
  }
  return out;
}

/** Decode a file, apply a monochrome mode, and re-encode as PNG. Browser-only. */
export async function applyMono(
  file: File,
  opts: { mode: MonoMode; threshold?: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Canvas is not supported in this browser');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result =
    opts.mode === 'grayscale'
      ? toGrayscale(src)
      : opts.mode === 'dither'
        ? toDitheredBW(src)
        : toBlackWhite(src, opts.threshold ?? 128);
  // The transforms return a plain {width,height,data} clone; copy the bytes back
  // into the real ImageData from getImageData so putImageData accepts it (the
  // browser rejects a duck-typed object).
  src.data.set(result.data);
  ctx.putImageData(src, 0, 0);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), 'image/png'),
  );
}
