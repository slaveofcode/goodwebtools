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
 * Parse a page spec into an ordered, de-duplicated list of 1-indexed pages.
 * Supports single pages and ranges, e.g. "1, 3, 5-7, 10". Reversed ranges
 * (e.g. "5-1") are expanded in descending order.
 */
export function parsePageSpec(spec: string): number[] {
  const result: number[] = [];
  const seen = new Set<number>();
  const add = (n: number) => {
    if (n >= 1 && !seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  };
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      const step = a <= b ? 1 : -1;
      for (let i = a; step > 0 ? i <= b : i >= b; i += step) add(i);
    } else if (/^\d+$/.test(trimmed)) {
      add(Number(trimmed));
    }
  }
  return result;
}

/**
 * Extract the given 1-indexed pages (in the given order) into a new PDF.
 * Out-of-range pages are ignored; throws if nothing valid remains.
 */
export async function extractPageList(file: File, pageNumbers: number[]): Promise<Blob> {
  const src = await PDFDocument.load(await readBytes(file));
  const total = src.getPageCount();
  const indices = pageNumbers.filter(n => n >= 1 && n <= total).map(n => n - 1);
  if (indices.length === 0) throw new Error(`No valid pages selected — this PDF has ${total} page(s).`);

  const out = await PDFDocument.create();
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

export type WatermarkLayout = 'diagonal' | 'tiled' | 'horizontal';

export interface WatermarkOptions {
  layout: WatermarkLayout;
  /** 0–1 */
  opacity: number;
  /** each channel 0–1 */
  color: { r: number; g: number; b: number };
  /** font size as a fraction of the page's longest side */
  fontScale: number;
}

/** Draw a text watermark across every page using the given options. */
export async function addWatermark(
  file: File,
  text: string,
  options: WatermarkOptions
): Promise<Blob> {
  const doc = await PDFDocument.load(await readBytes(file));
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(options.color.r, options.color.g, options.color.b);

  doc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    const fontSize = Math.max(width, height) * options.fontScale;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    const draw = (x: number, y: number, rotateDegrees: number) =>
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color,
        opacity: options.opacity,
        rotate: degrees(rotateDegrees),
      });

    if (options.layout === 'horizontal') {
      draw(width / 2 - textWidth / 2, height / 2 - fontSize / 2, 0);
    } else if (options.layout === 'diagonal') {
      const angle = Math.PI / 4;
      draw(
        width / 2 - (textWidth / 2) * Math.cos(angle),
        height / 2 - (textWidth / 2) * Math.sin(angle),
        45
      );
    } else {
      // Tiled: repeat the text on a diagonal grid covering the whole page.
      const stepX = textWidth + fontSize * 2;
      const stepY = fontSize * 4;
      for (let y = -height; y < height * 2; y += stepY) {
        for (let x = -width; x < width * 2; x += stepX) {
          draw(x, y, 45);
        }
      }
    }
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
