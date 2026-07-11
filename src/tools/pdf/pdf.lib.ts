import { PDFDocument, degrees } from 'pdf-lib';

const PDF_MIME = 'application/pdf';

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: PDF_MIME });
}

async function readBytes(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/** Number of pages in a PDF file. */
export async function getPageCount(file: File): Promise<number> {
  const doc = await PDFDocument.load(await readBytes(file));
  return doc.getPageCount();
}

/** Merge several PDFs into one, preserving order. */
export async function mergePdfs(files: File[]): Promise<Blob> {
  const out = await PDFDocument.create();
  for (const file of files) {
    const src = await PDFDocument.load(await readBytes(file));
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(page => out.addPage(page));
  }
  return toBlob(await out.save());
}

/**
 * Extract an inclusive 1-indexed page range into a new PDF.
 * Invalid/empty ranges throw.
 */
export async function extractPages(file: File, from: number, to: number): Promise<Blob> {
  const src = await PDFDocument.load(await readBytes(file));
  const total = src.getPageCount();
  const start = Math.max(1, Math.min(from, to));
  const end = Math.min(total, Math.max(from, to));
  if (start > total || end < 1) throw new Error(`This PDF only has ${total} page(s).`);

  const out = await PDFDocument.create();
  const indices: number[] = [];
  for (let i = start - 1; i <= end - 1; i++) indices.push(i);
  const pages = await out.copyPages(src, indices);
  pages.forEach(page => out.addPage(page));
  return toBlob(await out.save());
}

/** Rotate every page by a multiple of 90 degrees (clockwise). */
export async function rotatePdf(file: File, turnDegrees: number): Promise<Blob> {
  const src = await PDFDocument.load(await readBytes(file));
  src.getPages().forEach(page => {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + turnDegrees) % 360));
  });
  return toBlob(await src.save());
}

/** Build a PDF from images (one image per page, page sized to the image). */
export async function imagesToPdf(images: File[]): Promise<Blob> {
  const out = await PDFDocument.create();
  for (const image of images) {
    const bytes = await readBytes(image);
    const isPng = image.type.includes('png') || image.name.toLowerCase().endsWith('.png');
    const embedded = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const page = out.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }
  return toBlob(await out.save());
}
