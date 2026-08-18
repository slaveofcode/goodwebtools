/**
 * Multi-format barcode decoding from an image File or a live camera frame.
 * Reuses the same pipeline as the QR reader — native BarcodeDetector first
 * (fast, no download), then zxing-wasm (ZXing C++ → wasm, robust everywhere,
 * served same-origin from /zxing_reader.wasm) — but for every 1D and 2D format.
 *
 * The decode functions are browser-only (they touch canvas / wasm); the format
 * helpers are pure and unit-tested.
 */

export interface BarcodeResult {
  text: string;
  format: string; // friendly, normalised (e.g. 'EAN-13', 'Code 128', 'QR Code')
}

/** Formats requested from zxing-wasm (its BarcodeFormat spelling). */
export const ZXING_FORMATS = [
  'Aztec', 'Codabar', 'Code128', 'Code39', 'Code93', 'DataBar', 'DataBarExpanded',
  'DataMatrix', 'EAN-13', 'EAN-8', 'ITF', 'MaxiCode', 'PDF417', 'QRCode',
  'MicroQRCode', 'UPC-A', 'UPC-E',
] as const;

const FRIENDLY: Record<string, string> = {
  ean13: 'EAN-13', ean8: 'EAN-8', upca: 'UPC-A', upce: 'UPC-E',
  code128: 'Code 128', code39: 'Code 39', code93: 'Code 93',
  itf: 'ITF', codabar: 'Codabar',
  databar: 'DataBar', databarexpanded: 'DataBar Expanded',
  datamatrix: 'Data Matrix', pdf417: 'PDF417', aztec: 'Aztec',
  qrcode: 'QR Code', microqrcode: 'Micro QR', maxicode: 'MaxiCode',
};

const TWO_D = new Set(['QR Code', 'Micro QR', 'Data Matrix', 'PDF417', 'Aztec', 'MaxiCode']);

/**
 * Normalise a raw format name from either BarcodeDetector ('ean_13') or
 * zxing-wasm ('EAN-13') into a single friendly label.
 */
export function normalizeFormat(raw: string): string {
  if (!raw) return 'Unknown';
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return FRIENDLY[key] ?? raw;
}

/** Whether a friendly format is a 2D (matrix) code rather than a 1D barcode. */
export function formatKind(friendly: string): '1D' | '2D' {
  return TWO_D.has(friendly) ? '2D' : '1D';
}

/* ------------------------------------------------------------------ *
 * Browser-only decoders (dynamic-import the wasm so the chunk stays small)
 * ------------------------------------------------------------------ */

interface DetectedBarcode { rawValue: string; format?: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/** Decode with the native BarcodeDetector (all supported formats), or null. */
export async function decodeWithDetector(source: CanvasImageSource): Promise<BarcodeResult | null> {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const codes = await new Ctor().detect(source);
    const hit = codes[0];
    if (!hit?.rawValue) return null;
    return { text: hit.rawValue, format: normalizeFormat(hit.format ?? '') };
  } catch {
    return null;
  }
}

/** Decode with zxing-wasm (all formats, tryHarder), or null. */
export async function decodeWithZxing(input: Blob): Promise<BarcodeResult | null> {
  try {
    const { readBarcodes, prepareZXingModule } = await import('zxing-wasm/reader');
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? '/zxing_reader.wasm' : prefix + path,
      },
    });
    const results = await readBarcodes(input, {
      formats: [...ZXING_FORMATS],
      tryHarder: true,
      maxNumberOfSymbols: 1,
    });
    const hit = results[0];
    if (!hit?.text) return null;
    return { text: hit.text, format: normalizeFormat(hit.format ?? '') };
  } catch {
    return null;
  }
}

/** Decode the first barcode found in an image File, or null. Browser-only. */
export async function decodeBarcodeFromFile(file: File): Promise<BarcodeResult | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    return (await decodeWithDetector(bitmap)) ?? (await decodeWithZxing(file));
  } finally {
    bitmap?.close?.();
  }
}
