import * as Comlink from 'comlink';
import type { Remote } from 'comlink';
import type { MupdfApi } from './mupdf.worker';
import MupdfWorker from './mupdf.worker?worker';

const PDF_MIME = 'application/pdf';

// Single long-lived worker so the ~10MB wasm loads only once, then is reused
// across every PDF operation and tool.
let remote: Remote<MupdfApi> | null = null;
function engine(): Remote<MupdfApi> {
  if (!remote) remote = Comlink.wrap<MupdfApi>(new MupdfWorker());
  return remote;
}

async function bytesOf(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
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
