export interface RenderedPage {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
}

export interface FirstPageRender {
  blob: Blob;
  width: number;
  height: number;
  pageCount: number;
}

/**
 * Render just page 1 of a PDF (from raw bytes) to a PNG — used for previews.
 * Reports the total page count so callers can show "page 1 of N".
 */
export async function renderFirstPage(
  data: ArrayBuffer | Uint8Array,
  scale: number
): Promise<FirstPageRender> {
  const pdfjs = await import('pdfjs-dist');
  const PdfjsWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
  const worker = new PdfjsWorker();
  pdfjs.GlobalWorkerOptions.workerPort = worker;

  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const pageCount = pdf.numPages;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas not supported');

    await page.render({ canvasContext: context, viewport, canvas }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        result => (result ? resolve(result) : reject(new Error('Failed to encode preview'))),
        'image/png'
      )
    );
    return { blob, width: canvas.width, height: canvas.height, pageCount };
  } finally {
    await loadingTask.destroy();
    worker.terminate();
  }
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
