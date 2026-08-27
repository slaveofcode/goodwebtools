/** Pure dominant-color extraction for the Image Palette tool. */

export interface Swatch {
  hex: string;
  /** Sampled pixel count landing in this color bucket. */
  count: number;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Extract the `k` most common colors from RGBA pixel data. Colors are quantized
 * to 4 bits per channel (buckets of 16) so near-identical shades group together,
 * then ranked by frequency. Every `step`-th pixel is sampled for speed.
 */
export function extractPalette(data: Uint8ClampedArray, k = 6, step = 4): Swatch[] {
  const counts = new Map<number, number>();
  const stride = 4 * Math.max(1, step);
  for (let i = 0; i + 3 < data.length; i += stride) {
    if (data[i + 3] < 128) continue; // skip mostly-transparent pixels
    const r = data[i] & 0xf0;
    const g = data[i + 1] & 0xf0;
    const b = data[i + 2] & 0xf0;
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([key, count]) => ({ hex: rgbToHex((key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff), count }));
}
