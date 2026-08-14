import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { pageNumberXY, placementToPdfRect, type PageNumberOptions, type SignPlacement } from './layout.lib';

// Loading/parsing existing PDFs is handled by the mupdf engine (in a worker) —
// it parses the wide range of real-world PDFs that pdf-lib's parser rejects.
// pdf-lib is kept for tasks that build/draw from scratch (images→PDF, watermark).
export {
  getPageCount,
  mergePdfs,
  extractPageList,
  rotatePdf,
  deletePages,
  compressPdf,
  pdfNeedsPassword,
  protectPdf,
  unlockPdf,
  repairPdf,
  type RepairResult,
} from './mupdf.client';
import { normalizePdf } from './mupdf.client';

const PDF_MIME = 'application/pdf';

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: PDF_MIME });
}

async function readBytes(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
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

// pdf-lib page/font types are structural; keep this loosely typed to avoid
// importing internal types just for the helper signature.
type PdfPage = ReturnType<PDFDocument['getPages']>[number];
type PdfFont = Awaited<ReturnType<PDFDocument['embedFont']>>;

/** Draw the watermark onto a single page. Shared by full-doc + preview paths. */
function drawWatermark(page: PdfPage, font: PdfFont, text: string, options: WatermarkOptions) {
  const { width, height } = page.getSize();
  const fontSize = Math.max(width, height) * options.fontScale;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const color = rgb(options.color.r, options.color.g, options.color.b);

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
}

// Normalize through mupdf first so pdf-lib can parse any real-world PDF, then
// draw the watermark with pdf-lib. ignoreEncryption is safe here because the
// bytes come straight from mupdf's own writer.
async function loadViaMupdf(file: File): Promise<PDFDocument> {
  const clean = await normalizePdf(file);
  return PDFDocument.load(clean, { ignoreEncryption: true });
}

/** Draw a text watermark across every page using the given options. */
export async function addWatermark(
  file: File,
  text: string,
  options: WatermarkOptions
): Promise<Blob> {
  return toBlob(await buildWatermarkPreview(file, text, options));
}

/**
 * Build the full watermarked PDF (all pages) as raw bytes — used both for the
 * live preview and (wrapped in a Blob) for the download.
 */
export async function buildWatermarkPreview(
  file: File,
  text: string,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const src = await loadViaMupdf(file);
  // Copy pages into a fresh document. Drawing on the loaded doc and re-saving
  // keeps the source's encryption dictionary, which corrupts the output; a
  // fresh PDFDocument.create() is clean and unencrypted.
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach(page => out.addPage(page));
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  out.getPages().forEach(page => drawWatermark(page, font, text, options));
  return out.save();
}

/**
 * Rebuild a PDF with pages in `order` (0-indexed; omit an index to drop that
 * page), optionally stamping page numbers.
 */
export async function organizePdf(
  file: File,
  order: number[],
  pageNumbers?: PageNumberOptions,
): Promise<Blob> {
  const src = await loadViaMupdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, order);
  pages.forEach(page => out.addPage(page));

  if (pageNumbers?.enabled) {
    const font = await out.embedFont(StandardFonts.Helvetica);
    out.getPages().forEach((page, i) => {
      const { width, height } = page.getSize();
      const label = String(pageNumbers.startAt + i);
      const textWidth = font.widthOfTextAtSize(label, pageNumbers.fontSize);
      const { x, y } = pageNumberXY(pageNumbers.position, width, height, textWidth, pageNumbers.fontSize, pageNumbers.margin);
      page.drawText(label, { x, y, size: pageNumbers.fontSize, font, color: rgb(0, 0, 0) });
    });
  }
  return toBlob(await out.save());
}

/** Stamp a signature PNG onto the given page placements. */
export async function signPdf(
  file: File,
  signaturePng: Uint8Array,
  placements: SignPlacement[],
): Promise<Blob> {
  const src = await loadViaMupdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach(page => out.addPage(page));

  const img = await out.embedPng(signaturePng);
  const aspect = img.width / img.height;
  const docPages = out.getPages();
  for (const placement of placements) {
    const page = docPages[placement.pageIndex];
    if (!page) continue;
    const { width, height } = page.getSize();
    page.drawImage(img, placementToPdfRect(placement, width, height, aspect));
  }
  return toBlob(await out.save());
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
