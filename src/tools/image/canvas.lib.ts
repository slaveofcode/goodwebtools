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
