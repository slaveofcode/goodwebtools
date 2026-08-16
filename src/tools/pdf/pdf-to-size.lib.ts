/**
 * Compress a PDF toward a target file size. First tries mupdf's lossless
 * compression (keeps selectable text); if that isn't small enough, rasterizes
 * pages at progressively lower resolution/quality until the target is met.
 * Browser-only.
 */
import { compressPdf } from './pdf.lib';
import { openPdfRenderer } from './render.lib';

export interface PdfCompressResult {
  blob: Blob;
  achieved: boolean;
  /** True when pages were flattened to images (text is no longer selectable). */
  rasterized: boolean;
}

const RASTER_STEPS: [scale: number, quality: number][] = [
  [1.5, 0.7], [1.25, 0.6], [1.0, 0.55], [0.85, 0.5], [0.7, 0.45], [0.55, 0.4], [0.45, 0.35],
];

export async function compressPdfToTarget(
  file: File,
  targetBytes: number,
  onStage?: (stage: 'lossless' | 'rasterizing') => void,
): Promise<PdfCompressResult> {
  onStage?.('lossless');
  const lossless = await compressPdf(file);
  if (lossless.size <= targetBytes) return { blob: lossless, achieved: true, rasterized: false };

  const { PDFDocument } = await import('pdf-lib');
  const data = await file.arrayBuffer();
  let smallest = lossless;
  for (const [scale, quality] of RASTER_STEPS) {
    onStage?.('rasterizing');
    const renderer = await openPdfRenderer(data);
    try {
      const out = await PDFDocument.create();
      for (let p = 1; p <= renderer.pageCount; p++) {
        const page = await renderer.renderPage(p, scale, 'image/jpeg', quality);
        const bytes = new Uint8Array(await page.blob.arrayBuffer());
        const img = await out.embedJpg(bytes);
        const pg = out.addPage([img.width, img.height]);
        pg.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const blob = new Blob([await out.save()], { type: 'application/pdf' });
      if (blob.size <= targetBytes) return { blob, achieved: true, rasterized: true };
      if (blob.size < smallest.size) smallest = blob;
    } finally {
      renderer.destroy();
    }
  }
  return { blob: smallest, achieved: false, rasterized: smallest !== lossless };
}
