/**
 * Robust QR decoding from an image File — tuned for real camera photos of
 * QRIS standees and QR codes (glare, angle, small code in a big frame).
 *
 * Pipeline, fastest/cheapest first:
 *   1. Native BarcodeDetector (great on Android/Chrome, no download).
 *   2. zxing-wasm with tryHarder (ZXing C++ → wasm; robust on every browser,
 *      incl. iOS Safari; wasm served same-origin from /zxing_reader.wasm).
 *   3. jsQR retried at several downscaled sizes (last-resort fallback).
 */
import jsQR from 'jsqr';

/** Candidate max-dimension targets to try with jsQR, de-duplicated. */
export function qrScaleTargets(width: number, height: number): number[] {
  const longest = Math.max(width, height);
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

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

function drawScaled(bitmap: ImageBitmap, target: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const scale = target / Math.max(bitmap.width, bitmap.height);
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function tryBarcodeDetector(bitmap: ImageBitmap): Promise<string | null> {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const canvas = drawScaled(bitmap, Math.min(1600, Math.max(bitmap.width, bitmap.height)));
    if (!canvas) return null;
    const codes = await new Ctor({ formats: ['qr_code'] }).detect(canvas);
    return codes[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

async function tryZxing(file: File): Promise<string | null> {
  try {
    const { readBarcodes, prepareZXingModule } = await import('zxing-wasm/reader');
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? '/zxing_reader.wasm' : prefix + path,
      },
    });
    const results = await readBarcodes(file, {
      formats: ['QRCode'],
      tryHarder: true,
      maxNumberOfSymbols: 1,
    });
    return results[0]?.text || null;
  } catch {
    return null;
  }
}

function tryJsQr(bitmap: ImageBitmap): string | null {
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
}

/** Decode the first QR code found in an image File, or null. Browser-only. */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return (await tryBarcodeDetector(bitmap)) ?? (await tryZxing(file)) ?? tryJsQr(bitmap);
  } finally {
    bitmap.close?.();
  }
}
