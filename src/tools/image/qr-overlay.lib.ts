import QRCode from 'qrcode';
import { keepFormat, encodeCanvas, type ProcessedImage } from './canvas.lib';

export type QrCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface QrOverlayOptions {
  content: string;
  corner: QrCorner;
  sizePercent: number; // 1–100, fraction of the shorter side
  card: boolean; // white rounded backing card
}

const MIN_QR_PX = 64; // scannable floor

/** QR pixel size as a percent of the image's shorter side, clamped to a scannable range. */
export function qrPixelSize(sizePercent: number, shorterSide: number): number {
  const pct = Math.min(100, Math.max(1, sizePercent));
  const raw = Math.round((shorterSide * pct) / 100);
  return Math.min(shorterSide, Math.max(MIN_QR_PX, raw));
}

export interface QrPlacement {
  x: number;
  y: number;
}

/** Top-left corner of the QR box (card or bare QR), inset from the chosen corner by margin. */
export function qrCardPlacement(args: {
  canvasW: number;
  canvasH: number;
  boxSize: number;
  margin: number;
  corner: QrCorner;
}): QrPlacement {
  const { canvasW, canvasH, boxSize, margin, corner } = args;
  const x = corner === 'top-left' || corner === 'bottom-left' ? margin : canvasW - margin - boxSize;
  const y = corner === 'top-left' || corner === 'top-right' ? margin : canvasH - margin - boxSize;
  return { x, y };
}

/** Fill a rounded rectangle. */
function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

/** Composite a QR code (encoding `content`) onto an image, preserving its format. */
export async function overlayQr(file: File, options: QrOverlayOptions): Promise<ProcessedImage> {
  const content = options.content.trim();
  if (!content) throw new Error('Enter the QR content');

  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Canvas is not supported in this browser');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const qrSize = qrPixelSize(options.sizePercent, Math.min(width, height));

  // Render the QR to an offscreen canvas.
  const qrCanvas = document.createElement('canvas');
  try {
    await QRCode.toCanvas(qrCanvas, content, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  } catch {
    throw new Error('Text is too long for a QR code');
  }

  const margin = Math.round(Math.min(width, height) * 0.03);

  if (options.card) {
    const pad = Math.round(qrSize * 0.12);
    const boxSize = qrSize + pad * 2;
    const pos = qrCardPlacement({ canvasW: width, canvasH: height, boxSize, margin, corner: options.corner });
    ctx.fillStyle = '#ffffff';
    fillRoundedRect(ctx, pos.x, pos.y, boxSize, boxSize, pad);
    ctx.drawImage(qrCanvas, pos.x + pad, pos.y + pad, qrSize, qrSize);
  } else {
    const pos = qrCardPlacement({ canvasW: width, canvasH: height, boxSize: qrSize, margin, corner: options.corner });
    ctx.drawImage(qrCanvas, pos.x, pos.y, qrSize, qrSize);
  }

  const { mime, quality } = keepFormat(file.type);
  const blob = await encodeCanvas(canvas, mime, quality);
  return { blob, width, height };
}
