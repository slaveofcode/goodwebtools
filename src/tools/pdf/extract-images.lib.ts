/**
 * Extract embedded raster images from a PDF using pdf.js — pulls the image
 * XObjects referenced by each page (not page renders). Browser-only; the pure
 * pixel helper is unit-tested.
 */

export interface ExtractedImage {
  name: string;
  blob: Blob;
  width: number;
  height: number;
}

/** Expand packed RGB (3 bytes/pixel) to RGBA (4 bytes/pixel, opaque). */
export function rgbToRgba(rgb: Uint8Array | Uint8ClampedArray, pixels: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    out[i * 4] = rgb[i * 3];
    out[i * 4 + 1] = rgb[i * 3 + 1];
    out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

interface PdfImageObj {
  width?: number;
  height?: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: ImageBitmap;
}

const RGBA_32BPP = 3;

async function objToBlob(obj: PdfImageObj): Promise<{ blob: Blob; width: number; height: number } | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (obj.bitmap) {
    canvas.width = obj.bitmap.width;
    canvas.height = obj.bitmap.height;
    ctx.drawImage(obj.bitmap, 0, 0);
  } else if (obj.data && obj.width && obj.height) {
    const { width, height, data } = obj;
    const pixels = width * height;
    let rgba: Uint8ClampedArray;
    if (obj.kind === RGBA_32BPP || data.length === pixels * 4) {
      rgba = Uint8ClampedArray.from(data);
    } else if (data.length === pixels * 3) {
      rgba = rgbToRgba(data, pixels);
    } else {
      return null; // unsupported packing (e.g. 1bpp mask)
    }
    canvas.width = width;
    canvas.height = height;
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);
  } else {
    return null;
  }

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
  return blob ? { blob, width: canvas.width, height: canvas.height } : null;
}

function resolveObj(page: { objs: { has(n: string): boolean; get(n: string, cb?: (o: unknown) => void): unknown } }, name: string): Promise<PdfImageObj | null> {
  return new Promise(resolve => {
    const done = (o: unknown) => resolve((o as PdfImageObj) ?? null);
    try {
      if (page.objs.has(name)) { resolve(page.objs.get(name) as PdfImageObj); return; }
    } catch { /* not ready — fall through to callback */ }
    page.objs.get(name, done);
    setTimeout(() => resolve(null), 5000);
  });
}

/** Extract every embedded raster image from the PDF bytes. */
export async function extractPdfImages(data: ArrayBuffer | Uint8Array): Promise<ExtractedImage[]> {
  const pdfjs = await import('pdfjs-dist');
  const PdfjsWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
  const worker = new PdfjsWorker();
  pdfjs.GlobalWorkerOptions.workerPort = worker;

  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const imageOps = new Set<number>([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintImageXObjectRepeat,
  ]);

  const results: ExtractedImage[] = [];
  const seen = new Set<string>();
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (!imageOps.has(ops.fnArray[i])) continue;
        const name = ops.argsArray[i]?.[0];
        if (typeof name !== 'string' || seen.has(name)) continue;
        seen.add(name);
        const obj = await resolveObj(page, name);
        if (!obj) continue;
        const rendered = await objToBlob(obj);
        if (rendered) {
          results.push({ name: `image-${results.length + 1}.png`, ...rendered });
        }
      }
    }
  } finally {
    loadingTask.destroy();
    worker.terminate();
  }
  return results;
}
