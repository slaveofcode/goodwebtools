/**
 * Assemble an .ico file from PNG images (PNG-in-ICO, supported since Vista).
 * Pure byte assembly — unit-tested separately.
 */
export function buildIco(pngs: Uint8Array[], sizes: number[]): Uint8Array {
  const count = pngs.length;
  const headerSize = 6 + count * 16;
  let dataOffset = headerSize;

  const total = new Uint8Array(headerSize + pngs.reduce((sum, p) => sum + p.length, 0));
  const view = new DataView(total.buffer);

  // ICONDIR
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: 1 = icon
  view.setUint16(4, count, true);

  pngs.forEach((png, i) => {
    const size = sizes[i];
    const entry = 6 + i * 16;
    total[entry] = size >= 256 ? 0 : size; // width (0 means 256)
    total[entry + 1] = size >= 256 ? 0 : size; // height
    total[entry + 2] = 0; // color palette count
    total[entry + 3] = 0; // reserved
    view.setUint16(entry + 4, 1, true); // color planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, png.length, true); // size of image data
    view.setUint32(entry + 12, dataOffset, true); // offset of image data
    dataOffset += png.length;
  });

  let position = headerSize;
  for (const png of pngs) {
    total.set(png, position);
    position += png.length;
  }
  return total;
}

async function renderPng(bitmap: ImageBitmap, size: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, size, size);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to encode'))), 'image/png')
  );
  return new Uint8Array(await blob.arrayBuffer());
}

/** Convert an image to a multi-resolution favicon (.ico). */
export async function imageToIco(file: File, sizes: number[] = [16, 32, 48]): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const pngs = await Promise.all(sizes.map(size => renderPng(bitmap, size)));
    return new Blob([buildIco(pngs, sizes)], { type: 'image/x-icon' });
  } finally {
    bitmap.close?.();
  }
}

/** Convert an image to a single-frame GIF (256-color quantized). */
export async function imageToGif(file: File): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Canvas is not supported');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const { data } = ctx.getImageData(0, 0, width, height);
  const palette = quantize(data, 256);
  const index = applyPalette(data, palette);
  const gif = GIFEncoder();
  gif.writeFrame(index, width, height, { palette });
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Wrap an image inside an SVG document (embedded, not vectorized). */
export async function imageToSvg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  bitmap.close?.();
  const dataUrl = await fileToDataUrl(file);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<image href="${dataUrl}" width="${width}" height="${height}"/></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

/** Feature-detect whether canvas.toBlob can actually encode a given format. */
export async function canvasSupportsType(mimeType: string): Promise<boolean> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType));
    return !!blob && blob.type === mimeType;
  } catch {
    return false;
  }
}
