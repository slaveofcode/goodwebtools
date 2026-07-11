import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

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

/**
 * Remove the given 1-indexed pages, keeping the rest in order.
 * Throws if the removal would leave no pages.
 */
export async function deletePages(file: File, removeList: number[]): Promise<Blob> {
  const src = await PDFDocument.load(await readBytes(file));
  const total = src.getPageCount();
  const remove = new Set(removeList.map(n => n - 1).filter(i => i >= 0 && i < total));
  const keep: number[] = [];
  for (let i = 0; i < total; i++) if (!remove.has(i)) keep.push(i);
  if (keep.length === 0) throw new Error('Cannot remove every page.');

  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach(page => out.addPage(page));
  return toBlob(await out.save());
}

/** Draw a diagonal, semi-transparent text watermark across every page. */
export async function addWatermark(file: File, text: string): Promise<Blob> {
  const doc = await PDFDocument.load(await readBytes(file));
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    const fontSize = Math.max(width, height) / 14;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    // Anchor so the 45°-rotated text runs through the page centre.
    const angle = Math.PI / 4;
    page.drawText(text, {
      x: width / 2 - (textWidth / 2) * Math.cos(angle),
      y: height / 2 - (textWidth / 2) * Math.sin(angle),
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.25,
      rotate: degrees(45),
    });
  });
  return toBlob(await doc.save());
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
