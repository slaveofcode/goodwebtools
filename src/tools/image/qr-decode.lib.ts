/**
 * Robust QR decoding from an image File. jsQR struggles on very large photos
 * (e.g. a 12-megapixel phone shot of a QRIS standee), so we retry the decode
 * at several downscaled sizes — this dramatically improves detection on real
 * photos with glare, angle and a small QR in a big frame. jsQR already handles
 * rotation internally via the finder patterns, so scaling is the key lever.
 */
import jsQR from 'jsqr';

/** Candidate max-dimension targets to try, largest-useful first, de-duplicated. */
export function qrScaleTargets(width: number, height: number): number[] {
  const longest = Math.max(width, height);
  // A capped full-size pass, then progressively smaller — most phone photos
  // decode best around 700–1200px on the long edge.
  const candidates = [Math.min(longest, 1600), 1000, 1300, 800, 600, 500];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of candidates) {
    const clamped = Math.min(t, longest);
    if (clamped >= 100 && !seen.has(clamped)) {
      seen.add(clamped);
      out.push(clamped);
    }
  }
  return out;
}

/** Decode the first QR code found in an image File, or null. Browser-only. */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const longest = Math.max(bitmap.width, bitmap.height);
    for (const target of qrScaleTargets(bitmap.width, bitmap.height)) {
      const scale = target / longest;
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const result = jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (result?.data) return result.data;
    }
    return null;
  } finally {
    bitmap.close?.();
  }
}
