import * as Comlink from 'comlink';
import type { Remote } from 'comlink';
import type { MupdfApi } from './mupdf.worker';
import MupdfWorker from './mupdf.worker?worker';

const PDF_MIME = 'application/pdf';

// Single long-lived worker so the ~10MB wasm loads only once, then is reused
// across every PDF operation and tool.
let remote: Remote<MupdfApi> | null = null;
function engine(): Remote<MupdfApi> {
  if (!remote) {
    const worker = new MupdfWorker();
    worker.addEventListener('error', event =>
      console.error('[mupdf worker] error:', event.message, event.filename, event.lineno)
    );
    worker.addEventListener('messageerror', event =>
      console.error('[mupdf worker] message error:', event)
    );
    remote = Comlink.wrap<MupdfApi>(worker);
  }
  return remote;
}

async function bytesOf(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    // Reading a very large PDF into one contiguous ArrayBuffer overruns a phone's
    // tab memory and throws a cryptic NotReadableError — surface a clear one.
    throw new Error('This PDF is too large to load in your browser — it ran out of memory. Try splitting it or use the desktop app.');
  }
}

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: PDF_MIME });
}

/** Re-save through mupdf into a clean structure that pdf-lib can parse. */
export async function normalizePdf(file: File): Promise<Uint8Array> {
  return engine().normalize(await bytesOf(file));
}

export async function getPageCount(file: File): Promise<number> {
  return engine().countPages(await bytesOf(file));
}

export interface RepairResult { blob: Blob; pages: number }

/** Repair a damaged PDF. `force` rebuilds it page-by-page from what's readable. */
export async function repairPdf(file: File, force = false): Promise<RepairResult> {
  const { bytes, pages } = await engine().repair(await bytesOf(file), force);
  return { blob: toBlob(bytes), pages };
}

export async function extractPageList(file: File, pageNumbers: number[]): Promise<Blob> {
  return toBlob(await engine().extractPages(await bytesOf(file), pageNumbers));
}

export async function mergePdfs(files: File[]): Promise<Blob> {
  const buffers = await Promise.all(files.map(bytesOf));
  return toBlob(await engine().merge(buffers));
}

export async function rotatePdf(file: File, turnDegrees: number): Promise<Blob> {
  return toBlob(await engine().rotate(await bytesOf(file), turnDegrees));
}

export async function deletePages(file: File, pageNumbers: number[]): Promise<Blob> {
  return toBlob(await engine().deletePages(await bytesOf(file), pageNumbers));
}

export async function compressPdf(file: File): Promise<Blob> {
  return toBlob(await engine().compress(await bytesOf(file)));
}

export async function pdfNeedsPassword(file: File): Promise<boolean> {
  return engine().needsPassword(await bytesOf(file));
}

export async function protectPdf(file: File, password: string): Promise<Blob> {
  return toBlob(await engine().protect(await bytesOf(file), password));
}

export async function unlockPdf(file: File, password: string): Promise<Blob> {
  return toBlob(await engine().unlock(await bytesOf(file), password));
}

/** A redaction rectangle as page-relative ratios with a top-left origin. */
export interface RedactBox {
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * True redaction — mupdf physically removes the text/images/line-art under each
 * box and burns a black rectangle in its place (not a removable overlay).
 */
export async function redactPdf(file: File, boxes: RedactBox[]): Promise<Blob> {
  return toBlob(await engine().redact(await bytesOf(file), boxes));
}

/** Read the document Info metadata without modifying the file. */
export async function readPdfMetadata(file: File): Promise<Record<string, string>> {
  return engine().readMetadata(await bytesOf(file));
}

/**
 * Strip all Info metadata via mupdf, then remove the XMP metadata stream with
 * pdf-lib. Returns the cleaned blob and the map of fields that were removed.
 */
export async function scrubPdfMetadata(file: File): Promise<{ blob: Blob; removed: Record<string, string> }> {
  const { bytes, removed } = await engine().scrubMetadata(await bytesOf(file));
  let cleaned = bytes;
  try {
    const { PDFDocument, PDFName } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    doc.catalog.delete(PDFName.of('Metadata')); // drop the XMP stream
    cleaned = await doc.save({ updateMetadata: false });
  } catch {
    // If pdf-lib can't parse it, the mupdf-cleaned bytes are still returned.
  }
  return { blob: toBlob(cleaned), removed };
}
