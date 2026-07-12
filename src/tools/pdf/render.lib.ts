export interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
}

export interface PdfRenderer {
  pageCount: number;
  /** Render a single 1-indexed page to an image blob (PNG by default). */
  renderPage(
    pageNumber: number,
    scale: number,
    mimeType?: string,
    quality?: number
  ): Promise<RenderedPage>;
  /** Tear down the pdf.js document and its worker. */
  destroy(): void;
}

/**
 * Open a PDF (from raw bytes) once and render its pages on demand. The document
 * and worker stay alive until destroy(), so flipping between pages is fast
 * (no re-parse). pdf.js and its worker load in the browser only.
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
    async renderPage(pageNumber, scale, mimeType = 'image/png', quality = 0.92) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas not supported');
      // JPEG has no alpha — paint a white background first.
      if (mimeType === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          result => (result ? resolve(result) : reject(new Error('Failed to encode page'))),
          mimeType,
          quality
        )
      );
      return { blob, width: canvas.width, height: canvas.height };
    },
    destroy() {
      loadingTask.destroy();
      worker.terminate();
    },
  };
}
