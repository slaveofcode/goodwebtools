import { keepFormat, encodeCanvas, type ProcessedImage } from './canvas.lib';

export type StampFont = 'sans' | 'serif' | 'mono' | 'condensed';
export type StampPlacement = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface StampOptions {
  text: string;
  color: string; // hex, e.g. '#c0392b'
  bold: boolean;
  italic: boolean;
  font: StampFont;
  bordered: boolean;
  placement: StampPlacement;
  scale: number; // 1–100 percent
  opacity: number; // 1–100 percent
}

/** Document-status presets. Clicking one fills the text + a sensible default color. */
export const STAMP_PRESETS: { label: string; color: string }[] = [
  { label: 'Confidential', color: '#c0392b' },
  { label: 'Paid', color: '#1e8449' },
  { label: 'Draft', color: '#616161' },
  { label: 'Approved', color: '#1e8449' },
  { label: 'Void', color: '#c0392b' },
  { label: 'Urgent', color: '#c0392b' },
  { label: 'Copy', color: '#2471a3' },
  { label: 'Original', color: '#2471a3' },
  { label: 'Sample', color: '#b9770e' },
  { label: 'For Review', color: '#b9770e' },
];

const FONT_STACKS: Record<StampFont, string> = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", monospace',
  condensed: '"Arial Narrow", "Roboto Condensed", sans-serif',
};

export function fontStackFor(font: StampFont): string {
  return FONT_STACKS[font] ?? FONT_STACKS.sans;
}

/**
 * Map a user-facing Scale percent (1–100) to a `fontScale` fraction of the
 * image's shorter side. Stamps read larger than watermarks: 1/16 (small) → 1/3 (big).
 */
export function stampFontScale(percent: number): number {
  const MIN_FS = 1 / 16;
  const MAX_FS = 1 / 3;
  const clamped = Math.min(100, Math.max(1, percent));
  return MIN_FS + ((clamped - 1) / 99) * (MAX_FS - MIN_FS);
}

export interface StampGeometry {
  cx: number;
  cy: number;
  boxW: number;
  boxH: number;
  rotation: number; // radians
}

/**
 * Compute where the stamp box sits and how it's rotated. Pure — no canvas.
 * Center placement is rotated -20° (the classic diagonal rubber-stamp look);
 * corners sit upright, inset from the edge by a margin.
 */
export function stampGeometry(args: {
  canvasW: number;
  canvasH: number;
  textW: number;
  fontSize: number;
  placement: StampPlacement;
}): StampGeometry {
  const { canvasW, canvasH, textW, fontSize, placement } = args;
  const padding = fontSize * 0.4;
  const boxW = textW + padding * 2;
  const boxH = fontSize + padding * 2;

  if (placement === 'center') {
    return { cx: canvasW / 2, cy: canvasH / 2, boxW, boxH, rotation: -Math.PI / 9 };
  }

  const margin = fontSize * 0.6;
  const left = margin + boxW / 2;
  const right = canvasW - margin - boxW / 2;
  const top = margin + boxH / 2;
  const bottom = canvasH - margin - boxH / 2;
  const cx = placement === 'top-left' || placement === 'bottom-left' ? left : right;
  const cy = placement === 'top-left' || placement === 'top-right' ? top : bottom;
  return { cx, cy, boxW, boxH, rotation: 0 };
}

/** Stroke a centered rounded rectangle at the current canvas origin. */
function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  radius: number
): void {
  const x = -w / 2;
  const y = -h / 2;
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
  ctx.stroke();
}

/** Composite a rubber-stamp mark onto an image, preserving its format. */
export async function stampImage(file: File, options: StampOptions): Promise<ProcessedImage> {
  const text = options.text.trim();
  if (!text) throw new Error('Enter stamp text');

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

  const fontSize = Math.max(14, Math.round(Math.min(width, height) * stampFontScale(options.scale)));
  const style = `${options.italic ? 'italic ' : ''}${options.bold ? 'bold ' : ''}`;
  ctx.font = `${style}${fontSize}px ${fontStackFor(options.font)}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textW = ctx.measureText(text).width;
  const g = stampGeometry({ canvasW: width, canvasH: height, textW, fontSize, placement: options.placement });

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0.01, options.opacity / 100));
  ctx.translate(g.cx, g.cy);
  ctx.rotate(g.rotation);

  if (options.bordered) {
    ctx.strokeStyle = options.color;
    ctx.lineWidth = Math.max(2, fontSize * 0.1);
    strokeRoundedRect(ctx, g.boxW, g.boxH, fontSize * 0.25);
  }
  ctx.fillStyle = options.color;
  ctx.fillText(text, 0, 0);
  ctx.restore();

  const { mime, quality } = keepFormat(file.type);
  const blob = await encodeCanvas(canvas, mime, quality);
  return { blob, width, height };
}
