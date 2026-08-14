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

  const drawable = obj.bitmap as CanvasImageSource | undefined;
  const w = obj.width || (drawable as { width?: number })?.width || 0;
  const h = obj.height || (drawable as { height?: number })?.height || 0;

  if (drawable && w && h) {
    canvas.width = w;
    canvas.height = h;
    try {
      ctx.drawImage(drawable, 0, 0, w, h);
    } catch {
      return null; // e.g. a detached ImageBitmap
    }
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
  // Use the legacy build: it polyfills newer JS (e.g. Uint8Array.prototype.toHex,
  // which pdf.js's default build assumes) so extraction works on older browsers.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const PdfjsWorker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker')).default;
  const worker = new PdfjsWorker();
  pdfjs.GlobalWorkerOptions.workerPort = worker;

  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const imageOps = new Set<number>([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintImageXObjectRepeat,
  ]);

  // A throwaway canvas used only to force pdf.js to decode each page's images
  // into page.objs — with the worker, getOperatorList() alone does not.
  const renderCanvas = document.createElement('canvas');
  const renderCtx = renderCanvas.getContext('2d');

  const results: ExtractedImage[] = [];
  const seen = new Set<string>();
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const ops = await page.getOperatorList();

      const names: string[] = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (!imageOps.has(ops.fnArray[i])) continue;
        const name = ops.argsArray[i]?.[0];
        if (typeof name === 'string' && !seen.has(name) && !names.includes(name)) names.push(name);
      }
      if (names.length === 0) continue;

      // Render the page (at a modest scale) so pdf.js decodes its image
      // XObjects and populates page.objs; the objects hold full-resolution data.
      if (renderCtx) {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1, 1200 / Math.max(base.width, base.height, 1));
        const viewport = page.getViewport({ scale });
        renderCanvas.width = Math.max(1, Math.floor(viewport.width));
        renderCanvas.height = Math.max(1, Math.floor(viewport.height));
        await page.render({ canvasContext: renderCtx, viewport, canvas: renderCanvas }).promise;
      }

      for (const name of names) {
        seen.add(name);
        const obj = await resolveObj(page, name);
        if (!obj) continue;
        const rendered = await objToBlob(obj);
        if (rendered) results.push({ name: `image-${results.length + 1}.png`, ...rendered });
      }
    }
  } finally {
    loadingTask.destroy();
    worker.terminate();
  }
  return results;
}
