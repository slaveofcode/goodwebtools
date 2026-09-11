/**
 * Pure helpers for the Video Recorder's effects pipeline (filters, green-screen
 * chroma key). DOM-free so they unit-test cleanly; the island owns the canvas,
 * camera stream and MediaPipe segmenter.
 */

export type EffectKind = 'none' | 'filter' | 'blur-bg' | 'replace-bg' | 'greenscreen';

export type FilterPreset = 'none' | 'grayscale' | 'sepia' | 'vivid' | 'cool' | 'warm' | 'invert';

export const FILTER_CSS: Record<FilterPreset, string> = {
  none: 'none',
  grayscale: 'grayscale(1)',
  sepia: 'sepia(0.85)',
  vivid: 'saturate(1.6) contrast(1.08)',
  cool: 'hue-rotate(-18deg) saturate(1.2) brightness(1.05)',
  warm: 'sepia(0.35) saturate(1.35) brightness(1.05)',
  invert: 'invert(1)',
};

export function filterCss(p: FilterPreset): string {
  return FILTER_CSS[p] ?? 'none';
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Parse `#rrggbb` (or `#rgb`) to RGB. Falls back to black on bad input. */
export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

/**
 * Green-screen chroma key: makes pixels within `threshold` (0–441, Euclidean
 * RGB distance) of `key` transparent, in place. Higher threshold removes more.
 */
export function applyChromaKey(data: Uint8ClampedArray, key: RGB, threshold: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - key.r;
    const dg = data[i + 1] - key.g;
    const db = data[i + 2] - key.b;
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= threshold) data[i + 3] = 0;
  }
}
