/**
 * HEIC/HEIF → JPEG conversion, entirely in the browser.
 *
 * Decoding uses libheif compiled to wasm (via the `heic-to` package, which
 * inlines the wasm), so nothing is ever uploaded. The heavy decoder is
 * dynamic-imported inside `heicToJpeg` to keep the island chunk small.
 */

const HEIC_EXT = /\.(heic|heif)$/i;
const HEIC_MIME = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

/**
 * Best-effort, synchronous check that a file is HEIC/HEIF — used to filter a
 * dropped batch before decoding. Browsers frequently report an empty or
 * generic MIME type for HEIC, so extension is the primary signal, with the
 * MIME type as a fallback for files that arrive without a `.heic`/`.heif` name.
 */
export function isLikelyHeic(file: { name: string; type: string }): boolean {
  return HEIC_EXT.test(file.name) || HEIC_MIME.has(file.type.toLowerCase());
}

/** Swap a filename's extension for `.jpg` (append it when there is none). */
export function jpegName(originalName: string): string {
  if (!originalName) return 'image.jpg';
  const base = originalName.includes('.')
    ? originalName.replace(/\.[^.]+$/, '')
    : originalName;
  return `${base}.jpg`;
}

/**
 * Decode a HEIC/HEIF file and re-encode it as JPEG at the given quality
 * (0–1). Throws if the file cannot be decoded (e.g. it is not really HEIC).
 */
export async function heicToJpeg(file: File, quality: number): Promise<Blob> {
  const { heicTo } = await import('heic-to');
  const q = Math.min(Math.max(quality, 0), 1);
  return heicTo({ blob: file, type: 'image/jpeg', quality: q });
}
