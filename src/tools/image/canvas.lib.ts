export interface ProcessOptions {
  /** Output MIME type, e.g. 'image/png' | 'image/jpeg' | 'image/webp'. */
  mimeType: string;
  /** 0–1 for lossy formats (JPEG/WebP). Ignored for PNG. */
  quality?: number;
  /** Target width in px (defaults to the source width). */
  width?: number;
  /** Target height in px (defaults to the source height). */
  height?: number;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Scale a height to match a new width, preserving aspect ratio. */
export function scaleToWidth(width: number, height: number, newWidth: number): number {
  if (width <= 0) return 0;
  return Math.max(1, Math.round((newWidth * height) / width));
}

/** Scale a width to match a new height, preserving aspect ratio. */
export function scaleToHeight(width: number, height: number, newHeight: number): number {
  if (height <= 0) return 0;
  return Math.max(1, Math.round((newHeight * width) / height));
}

/** Human-readable byte size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = byteSize / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Pick an output format, preserving JPEG/WebP but defaulting to PNG. */
export function keepFormat(type: string): { mime: string; ext: string; quality?: number } {
  if (type === 'image/jpeg') return { mime: 'image/jpeg', ext: 'jpg', quality: 0.92 };
  if (type === 'image/webp') return { mime: 'image/webp', ext: 'webp', quality: 0.92 };
  return { mime: 'image/png', ext: 'png' };
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      result => (result ? resolve(result) : reject(new Error('Failed to encode image'))),
      mimeType,
      quality
    )
  );
}

export type WatermarkLayout = 'diagonal' | 'tiled' | 'bottom-right';

export interface ImageWatermarkOptions {
  text: string;
  layout: WatermarkLayout;
  /** font size as a fraction of the image's shorter side */
  fontScale: number;
  /** 0–1 */
  opacity: number;
  /** hex color, e.g. '#ffffff' */
  color: string;
}

/** Draw a text watermark over an image (preserving its format). */
export async function watermarkImage(
  file: File,
  options: ImageWatermarkOptions
): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Canvas is not supported in this browser');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const fontSize = Math.max(12, Math.round(Math.min(width, height) * options.fontScale));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = options.color;
  ctx.globalAlpha = options.opacity;
  ctx.textBaseline = 'middle';

  if (options.layout === 'bottom-right') {
    ctx.textAlign = 'right';
    ctx.fillText(options.text, width - fontSize * 0.5, height - fontSize * 0.6);
  } else if (options.layout === 'diagonal') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = 'center';
    ctx.fillText(options.text, 0, 0);
    ctx.restore();
  } else {
    // Tiled: rotate the whole context, then stamp on a grid that covers it.
    const textWidth = ctx.measureText(options.text).width;
    ctx.save();
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = 'left';
    const stepX = textWidth + fontSize * 2;
    const stepY = fontSize * 4;
    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        ctx.fillText(options.text, x, y);
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  const { mime, quality } = keepFormat(file.type);
  const blob = await encodeCanvas(canvas, mime, quality);
  return { blob, width, height };
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Crop an image to a pixel region (preserving its format). */
export async function cropImage(file: File, region: CropRegion): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const width = Math.max(1, Math.round(region.width));
  const height = Math.max(1, Math.round(region.height));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Canvas is not supported in this browser');
  }
  const { mime, quality } = keepFormat(file.type);
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, region.x, region.y, width, height, 0, 0, width, height);
  bitmap.close?.();
  const blob = await encodeCanvas(canvas, mime, quality);
  return { blob, width, height };
}

/**
 * Decode an image file, draw it to a canvas at the requested size, and encode
 * it to the requested format. Re-encoding also strips all metadata (EXIF/GPS).
 * Browser-only (uses createImageBitmap + canvas).
 */
export async function processImage(file: File, options: ProcessOptions): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const width = Math.max(1, Math.floor(options.width ?? bitmap.width));
  const height = Math.max(1, Math.floor(options.height ?? bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close?.();
    throw new Error('Canvas is not supported in this browser');
  }
  // JPEG has no alpha channel — paint white behind transparent pixels.
  if (options.mimeType === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      result => (result ? resolve(result) : reject(new Error('Failed to encode image'))),
      options.mimeType,
      options.quality
    )
  );
  return { blob, width, height };
}
