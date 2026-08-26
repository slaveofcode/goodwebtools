/**
 * Pure DICOM pixel helpers: modality rescale, VOI window/level mapping to 8-bit
 * grey, and a transfer-syntax check. The actual parsing (dicom-parser) and canvas
 * rendering live in the island; the pixel maths is here and unit-tested.
 */

/** Uncompressed transfer syntaxes this viewer can render directly. */
const UNCOMPRESSED = new Set([
  '1.2.840.10008.1.2', // Implicit VR Little Endian
  '1.2.840.10008.1.2.1', // Explicit VR Little Endian
  '1.2.840.10008.1.2.2', // Explicit VR Big Endian
]);

export function isUncompressed(transferSyntaxUID: string): boolean {
  return UNCOMPRESSED.has(transferSyntaxUID);
}

/**
 * Number of frames from the DICOM `NumberOfFrames` (0028,0008) string.
 * Multi-frame objects (cine loops, volumes) pack every frame into one pixel-data
 * element; a missing or invalid value means a single-frame image.
 */
export function parseFrameCount(raw: string | undefined | null): number {
  const n = parseInt((raw ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Clamp the declared frame count to what the pixel data can actually hold, so a
 * wrong header never makes the viewer read past the buffer. `bytesPerFrame` is
 * rows × cols × samples × (bits > 8 ? 2 : 1).
 */
export function clampFrameCount(declared: number, availableBytes: number, bytesPerFrame: number): number {
  if (bytesPerFrame <= 0) return 1;
  const fit = Math.floor(availableBytes / bytesPerFrame);
  return Math.max(1, Math.min(declared, fit));
}

/** Modality rescale: stored value → real-world value. */
export function rescale(stored: number, slope: number, intercept: number): number {
  return stored * slope + intercept;
}

/**
 * DICOM VOI LUT (linear) mapping a value to 0–255 for the given window centre and
 * width. `invert` handles MONOCHROME1 (where higher values are darker).
 */
export function applyWindowLevel(value: number, center: number, width: number, invert: boolean): number {
  const w = width < 1 ? 1 : width;
  const lower = center - 0.5 - (w - 1) / 2;
  const upper = center - 0.5 + (w - 1) / 2;
  let out: number;
  if (value <= lower) out = 0;
  else if (value > upper) out = 255;
  else out = ((value - (center - 0.5)) / (w - 1) + 0.5) * 255;
  out = Math.max(0, Math.min(255, Math.round(out)));
  return invert ? 255 - out : out;
}
