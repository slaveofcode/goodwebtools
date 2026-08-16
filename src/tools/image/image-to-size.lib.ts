/**
 * Compress an image to hit a target file size by searching quality and, if
 * needed, downscaling. Browser-only (canvas). JPEG/WebP have a real quality
 * dial, so PNG inputs are re-encoded to one of those to reach a size target.
 */
import { encodeCanvas } from './canvas.lib';

export interface ImageCompressResult {
  blob: Blob;
  quality: number;
  /** Output dimensions as a percentage of the original (100 = full size). */
  scalePct: number;
  /** True if the target was met; false = smallest achievable is returned. */
  achieved: boolean;
}

const SCALES = [1, 0.85, 0.7, 0.55, 0.42, 0.32, 0.24, 0.18];

export async function compressImageToTarget(
  file: File,
  targetBytes: number,
  format: 'jpeg' | 'webp',
): Promise<ImageCompressResult> {
  const bitmap = await createImageBitmap(file);
  const mime = format === 'webp' ? 'image/webp' : 'image/jpeg';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let smallest: ImageCompressResult | null = null;
  try {
    if (!ctx) throw new Error('Canvas not supported');
    for (const scale of SCALES) {
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      canvas.width = w;
      canvas.height = h;
      if (mime === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(bitmap, 0, 0, w, h);

      // Binary-search the highest quality that still fits the target.
      let lo = 0.05;
      let hi = 0.98;
      let fit: ImageCompressResult | null = null;
      for (let i = 0; i < 8; i++) {
        const q = (lo + hi) / 2;
        const blob = await encodeCanvas(canvas, mime, q);
        if (blob.size <= targetBytes) {
          fit = { blob, quality: q, scalePct: Math.round(scale * 100), achieved: true };
          lo = q;
        } else {
          hi = q;
        }
      }
      if (fit) return fit; // largest scale that fits = best quality → done

      // Track the smallest we can make, as a fallback if the target is unreachable.
      const minBlob = await encodeCanvas(canvas, mime, 0.05);
      if (!smallest || minBlob.size < smallest.blob.size) {
        smallest = { blob: minBlob, quality: 0.05, scalePct: Math.round(scale * 100), achieved: false };
      }
    }
    return smallest as ImageCompressResult;
  } finally {
    bitmap.close?.();
  }
}
