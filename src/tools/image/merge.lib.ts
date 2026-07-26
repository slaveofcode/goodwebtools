export type MergeDirection = 'vertical' | 'horizontal' | 'grid';

export interface MergeOptions {
  /** Stack top-to-bottom, left-to-right, or in a fixed-column grid. */
  direction: MergeDirection;
  /** Gap between images, in px. */
  gap: number;
  /** Background fill: a hex color, or 'transparent'. */
  background: string;
  /**
   * Normalize the cross-axis: for 'vertical'/'grid', scale every image to the
   * same width; for 'horizontal', the same height. Uses the smallest cross-axis
   * size so images are only ever downscaled (no quality loss from upscaling).
   */
  match: boolean;
  /** Number of columns when direction === 'grid' (rows wrap automatically). */
  columns: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface MergePlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MergeLayout {
  width: number;
  height: number;
  placements: MergePlacement[];
}

/**
 * Compute the output canvas size and the position/size of each image when
 * merging them into one. Pure geometry — no canvas/DOM — so it is unit-tested.
 */
export function computeMergeLayout(sizes: Size[], options: MergeOptions): MergeLayout {
  const gap = Math.max(0, Math.round(options.gap));
  const clean = sizes.map(s => ({ width: Math.max(1, Math.round(s.width)), height: Math.max(1, Math.round(s.height)) }));

  if (clean.length === 0) return { width: 0, height: 0, placements: [] };

  if (options.direction === 'grid') {
    const n = clean.length;
    const columns = Math.max(1, Math.min(Math.round(options.columns || 1), n));
    const rows = Math.ceil(n / columns);
    // Optionally normalize every image to a common width (downscale-only).
    const commonWidth = Math.min(...clean.map(s => s.width));
    const scaled = clean.map(s =>
      options.match
        ? { w: commonWidth, h: Math.max(1, Math.round((s.height * commonWidth) / s.width)) }
        : { w: s.width, h: s.height }
    );
    // Each column is as wide as its widest image; each row as tall as its tallest.
    const colW = new Array(columns).fill(0);
    const rowH = new Array(rows).fill(0);
    scaled.forEach((s, i) => {
      const c = i % columns;
      const r = Math.floor(i / columns);
      colW[c] = Math.max(colW[c], s.w);
      rowH[r] = Math.max(rowH[r], s.h);
    });
    const colX: number[] = [];
    let ax = 0;
    for (let c = 0; c < columns; c++) { colX[c] = ax; ax += colW[c] + gap; }
    const rowY: number[] = [];
    let ay = 0;
    for (let r = 0; r < rows; r++) { rowY[r] = ay; ay += rowH[r] + gap; }
    const width = colW.reduce((a, b) => a + b, 0) + gap * (columns - 1);
    const height = rowH.reduce((a, b) => a + b, 0) + gap * (rows - 1);
    const placements = scaled.map((s, i) => {
      const c = i % columns;
      const r = Math.floor(i / columns);
      return {
        x: colX[c] + Math.round((colW[c] - s.w) / 2),
        y: rowY[r] + Math.round((rowH[r] - s.h) / 2),
        w: s.w,
        h: s.h,
      };
    });
    return { width, height, placements };
  }

  if (options.direction === 'vertical') {
    const commonWidth = options.match ? Math.min(...clean.map(s => s.width)) : Math.max(...clean.map(s => s.width));
    const scaled = clean.map(s => {
      const w = options.match ? commonWidth : s.width;
      const h = options.match ? Math.max(1, Math.round((s.height * commonWidth) / s.width)) : s.height;
      return { w, h };
    });
    const width = commonWidth;
    const height = scaled.reduce((sum, s) => sum + s.h, 0) + gap * (scaled.length - 1);
    let y = 0;
    const placements = scaled.map(s => {
      const x = Math.round((width - s.w) / 2); // centered when widths differ
      const p = { x, y, w: s.w, h: s.h };
      y += s.h + gap;
      return p;
    });
    return { width, height, placements };
  }

  // horizontal
  const commonHeight = options.match ? Math.min(...clean.map(s => s.height)) : Math.max(...clean.map(s => s.height));
  const scaled = clean.map(s => {
    const h = options.match ? commonHeight : s.height;
    const w = options.match ? Math.max(1, Math.round((s.width * commonHeight) / s.height)) : s.width;
    return { w, h };
  });
  const height = commonHeight;
  const width = scaled.reduce((sum, s) => sum + s.w, 0) + gap * (scaled.length - 1);
  let x = 0;
  const placements = scaled.map(s => {
    const y = Math.round((height - s.h) / 2);
    const p = { x, y, w: s.w, h: s.h };
    x += s.w + gap;
    return p;
  });
  return { width, height, placements };
}

export interface MergeResult {
  blob: Blob;
  width: number;
  height: number;
}

/** Merge multiple images into a single PNG, entirely in the browser. */
export async function mergeImages(files: File[], options: MergeOptions): Promise<MergeResult> {
  if (files.length === 0) throw new Error('Add at least one image to merge.');
  const bitmaps = await Promise.all(files.map(f => createImageBitmap(f)));
  try {
    const layout = computeMergeLayout(
      bitmaps.map(b => ({ width: b.width, height: b.height })),
      options
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, layout.width);
    canvas.height = Math.max(1, layout.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported in this browser');

    if (options.background !== 'transparent') {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingQuality = 'high';
    layout.placements.forEach((p, i) => ctx.drawImage(bitmaps[i], p.x, p.y, p.w, p.h));

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to encode image'))), 'image/png')
    );
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    bitmaps.forEach(b => b.close?.());
  }
}
