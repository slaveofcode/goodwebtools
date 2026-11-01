/**
 * Robust image decoding for the canvas-based image tools.
 *
 * `createImageBitmap(file)` alone fails for several real-world inputs:
 * HEIC/HEIF photos (iPhone, Samsung) — often with a `.jpg` name — SVG, and
 * TIFF outside Safari. Very large photos also exceed the browser's canvas
 * limits (iOS Safari caps a canvas at ~16.7 MP, so a 24–48 MP phone photo
 * fails to encode). This module sniffs the real format, decodes with a
 * fallback chain, and fits the output within the canvas limits.
 */

export type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'heic' | 'avif' | 'tiff' | 'bmp' | 'ico' | 'svg' | 'unknown';

export type DecodeFailure = 'empty' | 'heic' | 'tiff' | 'raw' | 'unsupported' | 'too-large';

/** A decode/encode failure with a reason the UI can explain in the user's language. */
export class ImageDecodeError extends Error {
  readonly kind: DecodeFailure;
  constructor(kind: DecodeFailure, message: string) {
    super(message);
    this.name = 'ImageDecodeError';
    this.kind = kind;
  }
}

/** Detect the real image container from the file's leading bytes. */
export function sniffImage(b: Uint8Array): ImageKind {
  const at = (i: number) => b[i];
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpeg';
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'png';
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) return 'gif';
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
      at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return 'webp';
  if (at(4) === 0x66 && at(5) === 0x74 && at(6) === 0x79 && at(7) === 0x70) {
    const brand = String.fromCharCode(at(8), at(9), at(10), at(11));
    if (/^(hei|hev|mif|msf)/.test(brand)) return 'heic';
    if (/^avi[fs]/.test(brand)) return 'avif';
  }
  if ((at(0) === 0x49 && at(1) === 0x49 && at(2) === 0x2a && at(3) === 0x00) ||
      (at(0) === 0x4d && at(1) === 0x4d && at(2) === 0x00 && at(3) === 0x2a)) return 'tiff';
  if (at(0) === 0x42 && at(1) === 0x4d) return 'bmp';
  if (at(0) === 0x00 && at(1) === 0x00 && at(2) === 0x01 && at(3) === 0x00) return 'ico';
  const text = new TextDecoder().decode(b.subarray(0, 256)).trimStart().toLowerCase();
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) return 'svg';
  return 'unknown';
}

export interface CanvasLimits {
  /** Max width × height a canvas can hold and still encode. */
  maxArea: number;
  /** Max width or height of a canvas. */
  maxSide: number;
}

/**
 * Canvas limits for the current engine. WebKit (all iOS browsers, and Safari)
 * caps the canvas area at 16,777,216 px. Chromium (Chrome, Samsung Internet,
 * Edge) handles sides up to 65,535 px and Firefox up to 32,767 px; past
 * ~268 MP neither can encode.
 */
export function canvasLimitsFor(userAgent: string, maxTouchPoints = 0): CanvasLimits {
  const iOS = /iP(hone|ad|od)/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const safari = /Safari\//.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|SamsungBrowser)\//.test(userAgent);
  if (iOS || safari) return { maxArea: 16_777_216, maxSide: 16_384 };
  if (/Firefox\//.test(userAgent)) return { maxArea: 268_435_456, maxSide: 32_767 };
  return { maxArea: 268_435_456, maxSide: 65_535 };
}

/** WebP can't encode a side longer than this. */
export const WEBP_MAX_SIDE = 16_383;
/** Nor can JPEG (libjpeg) past this. */
export const JPEG_MAX_SIDE = 65_500;

/** Scale width × height down (never up) so it fits within the limits, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, limits: CanvasLimits): { width: number; height: number; scaled: boolean } {
  const byArea = Math.sqrt(limits.maxArea / (width * height));
  const bySide = limits.maxSide / Math.max(width, height);
  const k = Math.min(1, byArea, bySide);
  if (k >= 1) return { width, height, scaled: false };
  return {
    width: Math.max(1, Math.floor(width * k)),
    height: Math.max(1, Math.floor(height * k)),
    scaled: true,
  };
}

/** Image source a canvas can draw: a bitmap, or an <img> for formats only it decodes. */
export type Decoded = { source: CanvasImageSource; width: number; height: number; close(): void };

function loadViaImg(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  return new Promise<Decoded>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // An SVG without width/height reports 0×0; give it a sensible default size.
      const width = img.naturalWidth || 1024;
      const height = img.naturalHeight || Math.round((1024 * (img.height || 1)) / (img.width || 1)) || 1024;
      resolve({ source: img, width, height, close: () => URL.revokeObjectURL(url) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img decode failed')); };
    img.src = url;
  });
}

async function fromBitmap(blob: Blob): Promise<Decoded> {
  const bmp = await createImageBitmap(blob);
  return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
}

/**
 * Decode any image the browser (or our HEIC decoder) can read. Throws an
 * ImageDecodeError whose `kind` explains why it couldn't.
 */
/** Camera RAW files (Samsung Expert RAW .dng, Sony .arw, Canon .cr2/.cr3, Nikon .nef, …). */
const RAW_EXT = /\.(dng|arw|cr2|cr3|nef|nrw|orf|raf|rw2|pef|srw)$/i;

export async function decodeImage(file: Blob): Promise<Decoded> {
  if (file.size === 0) throw new ImageDecodeError('empty', 'The file is empty.');
  const name = 'name' in file && typeof file.name === 'string' ? file.name : '';
  if (RAW_EXT.test(name)) throw new ImageDecodeError('raw', 'Camera RAW files can’t be opened in the browser.');
  const kind = sniffImage(new Uint8Array(await file.slice(0, 256).arrayBuffer()));

  if (kind === 'heic') {
    try { return await fromBitmap(file); } catch { /* most browsers can't — use the wasm decoder */ }
    try {
      const { heicTo } = await import('heic-to');
      const bmp = await heicTo({ blob: file, type: 'bitmap' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
    } catch {
      throw new ImageDecodeError('heic', 'This HEIC photo could not be decoded.');
    }
  }

  if (kind !== 'svg') {
    try { return await fromBitmap(file); } catch { /* fall through to <img> */ }
  }
  // SVG (and TIFF in Safari) decode through an <img> element.
  const typed = kind === 'svg' && file.type !== 'image/svg+xml' ? new Blob([file], { type: 'image/svg+xml' }) : file;
  try {
    return await loadViaImg(typed);
  } catch {
    if (kind === 'tiff') throw new ImageDecodeError('tiff', 'This browser can’t open TIFF images.');
    throw new ImageDecodeError('unsupported', 'The image could not be decoded.');
  }
}
