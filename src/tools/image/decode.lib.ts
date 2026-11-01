import { readExifSummary } from './exif.lib';

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
 * ~268 MP neither can encode. On Android phones we stop at 50 MP: a 108/200 MP
 * camera photo needs well over 1 GB while it's re-encoded and can crash the tab.
 */
export function canvasLimitsFor(userAgent: string, maxTouchPoints = 0): CanvasLimits {
  const iOS = /iP(hone|ad|od)/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const safari = /Safari\//.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|SamsungBrowser)\//.test(userAgent);
  if (iOS || safari) return { maxArea: 16_777_216, maxSide: 16_384 };
  const maxSide = /Firefox\//.test(userAgent) ? 32_767 : 65_535;
  if (/Android|Mobile/.test(userAgent)) return { maxArea: MOBILE_MAX_AREA, maxSide };
  return { maxArea: 268_435_456, maxSide };
}

/** Phone cap: just above Samsung's 50 MP mode (8160 × 6120). */
export const MOBILE_MAX_AREA = 50_000_000;

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

/**
 * Pixel size from the file header (JPEG SOF, PNG IHDR, GIF), as stored — before
 * EXIF rotation. null when it can't be read from these bytes.
 */
export function probeSize(b: Uint8Array): { width: number; height: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const kind = sniffImage(b);
  if (kind === 'png' && b.length >= 24) return { width: u32(16), height: u32(20) };
  if (kind === 'gif' && b.length >= 10) return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
  if (kind !== 'jpeg') return null;
  let p = 2;
  while (p + 9 < b.length) {
    if (b[p] !== 0xff) return null;
    const marker = b[p + 1];
    if (marker === 0xff) { p++; continue; } // fill byte
    // SOF0–SOF15 carry the frame size (C4/C8/CC are DHT/JPG/DAC, not frames).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: u16(p + 7), height: u16(p + 5) };
    }
    if (marker === 0xda) return null;
    p += 2 + u16(p + 2);
  }
  return null;
}

/** Image source a canvas can draw: a bitmap, or an <img> for formats only it decodes. */
export type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** True when it was decoded straight to a smaller size to fit the limits. */
  scaled?: boolean;
  close(): void;
};

/** Target size for an image of the given (display-oriented) size. */
export type FitFn = (width: number, height: number) => { width: number; height: number; scaled: boolean };

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

/** Camera RAW files (Samsung Expert RAW .dng, Sony .arw, Canon .cr2/.cr3, Nikon .nef, …). */
const RAW_EXT = /\.(dng|arw|cr2|cr3|nef|nrw|orf|raf|rw2|pef|srw)$/i;

/** Enough of the file to reach a JPEG's frame header past large EXIF/thumbnail segments. */
const HEAD_BYTES = 1 << 20;

/**
 * Decode any image the browser (or our HEIC decoder) can read. When `fit` asks
 * for a smaller size, JPEG/PNG/GIF are decoded straight to it, so a 200 MP
 * photo never has to sit in memory at full size. Throws an ImageDecodeError
 * whose `kind` explains why it couldn't decode.
 */
export async function decodeImage(file: Blob, fit?: FitFn): Promise<Decoded> {
  if (file.size === 0) throw new ImageDecodeError('empty', 'The file is empty.');
  const name = 'name' in file && typeof file.name === 'string' ? file.name : '';
  if (RAW_EXT.test(name)) throw new ImageDecodeError('raw', 'Camera RAW files can’t be opened in the browser.');
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const kind = sniffImage(head);

  const stored = fit ? probeSize(head) : null;
  if (fit && stored) {
    // createImageBitmap applies EXIF rotation before resizing, so ask for the rotated shape.
    const rotated = kind === 'jpeg' && (readExifSummary(head.buffer as ArrayBuffer)?.orientation ?? 1) >= 5;
    const target = rotated ? fit(stored.height, stored.width) : fit(stored.width, stored.height);
    if (target.scaled) {
      try {
        const bmp = await createImageBitmap(file, { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: 'high' });
        return { source: bmp, width: bmp.width, height: bmp.height, scaled: true, close: () => bmp.close?.() };
      } catch { /* fall back to a full-size decode */ }
    }
  }

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
