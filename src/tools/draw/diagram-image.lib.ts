import { toPng, toJpeg, toSvg, toCanvas } from 'html-to-image';

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'svg';

export function mimeFor(format: ImageFormat): string {
  return format === 'svg' ? 'image/svg+xml' : `image/${format}`;
}

export function pixelRatioFor(scale: number): number {
  return Math.min(3, Math.max(1, Math.round(scale) || 1));
}

/**
 * Render a DOM element (the react-flow viewport, pre-fitted to full bounds by
 * the caller) to an image blob. PNG/JPEG/SVG via html-to-image; WebP via canvas.
 */
export async function exportDiagramImage(
  el: HTMLElement,
  opts: { format: ImageFormat; scale?: number; background?: string },
): Promise<Blob> {
  const pixelRatio = pixelRatioFor(opts.scale ?? 1);
  const bg = opts.background ?? '#ffffff';

  if (opts.format === 'svg') {
    const dataUrl = await toSvg(el, { backgroundColor: bg });
    return (await fetch(dataUrl)).blob();
  }
  if (opts.format === 'png') {
    const dataUrl = await toPng(el, { pixelRatio, backgroundColor: bg });
    return (await fetch(dataUrl)).blob();
  }
  if (opts.format === 'jpeg') {
    const dataUrl = await toJpeg(el, { pixelRatio, quality: 0.95, backgroundColor: bg });
    return (await fetch(dataUrl)).blob();
  }
  // webp: render to a canvas, then encode.
  const canvas = await toCanvas(el, { pixelRatio, backgroundColor: bg });
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode WebP'))), 'image/webp', 0.95),
  );
}
