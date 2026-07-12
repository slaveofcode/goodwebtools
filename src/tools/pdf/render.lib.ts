export interface RenderedPage {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
}

export interface PdfRenderer {
  pageCount: number;
  /** Render a single 1-indexed page to a PNG blob. */
  renderPage(pageNumber: number, scale: number): Promise<Blob>;
  /** Tear down the pdf.js document and its worker. */
  destroy(): void;
}

/**
 * Open a PDF (from raw bytes) once and render its pages on demand — for a
 * paginated preview. The document and worker stay alive until destroy(), so
 * flipping between pages is fast (no re-parse).
 */
export async function openPdfRenderer(data: ArrayBuffer | Uint8Array): Promise<PdfRenderer> {
  const pdfjs = await import('pdfjs-dist');
  const PdfjsWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
  const worker = new PdfjsWorker();
  pdfjs.GlobalWorkerOptions.workerPort = worker;

  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  return {
    pageCount: pdf.numPages,
    async renderPage(pageNumber, scale) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas not supported');
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          result => (result ? resolve(result) : reject(new Error('Failed to encode preview'))),
          'image/png'
        )
      );
    },
    destroy() {
      loadingTask.destroy();
      worker.terminate();
    },
  };
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
  // Load the worker via Vite's ?worker so it's bundled up front. Using ?url
  // makes Vite process the worker on-demand mid-render, which re-optimizes deps
  // and invalidates the pdfjs-dist module hash ("Failed to fetch dynamically
  // imported module"). A dedicated worker per call avoids shared-state races.
  const PdfjsWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
  const worker = new PdfjsWorker();
  pdfjs.GlobalWorkerOptions.workerPort = worker;

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
    worker.terminate();
  }

  return pages;
}
