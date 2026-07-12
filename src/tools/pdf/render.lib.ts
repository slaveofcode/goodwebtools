export interface RenderedPage {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Render every page of a PDF to a PNG blob using pdf.js.
 *
 * pdf.js and its worker are imported dynamically so they only load in the
 * browser (never during Astro's SSR build) and only when the user acts.
 */
export async function renderPdfToImages(
  file: File,
  scale: number,
  onProgress?: (done: number, total: number) => void
): Promise<RenderedPage[]> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: RenderedPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas not supported');

      await page.render({ canvasContext: context, viewport, canvas }).promise;

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          result => (result ? resolve(result) : reject(new Error('Failed to encode page'))),
          'image/png'
        )
      );
      pages.push({ pageNumber, blob, width: canvas.width, height: canvas.height });
      onProgress?.(pageNumber, pdf.numPages);
    }
  } finally {
    // destroy() lives on the loading task; the document proxy only has cleanup()
    await loadingTask.destroy();
  }

  return pages;
}
