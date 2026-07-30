import { openPdfRenderer } from '@/tools/pdf/render.lib';

/** Number of pages in a PDF file. */
export async function getPdfPageCount(file: File): Promise<number> {
  const renderer = await openPdfRenderer(await file.arrayBuffer());
  try {
    return renderer.pageCount;
  } finally {
    renderer.destroy();
  }
}

/** Rasterize one 1-indexed PDF page to a PNG blob. */
export async function renderPdfPage(file: File, page: number, scale = 2): Promise<Blob> {
  const renderer = await openPdfRenderer(await file.arrayBuffer());
  try {
    const { blob } = await renderer.renderPage(page, scale, 'image/png');
    return blob;
  } finally {
    renderer.destroy();
  }
}
