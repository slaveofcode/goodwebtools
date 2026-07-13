/** Round up to the nearest multiple (LaMa needs dimensions divisible by 8). */
export function roundUpTo(n: number, multiple: number): number {
  return Math.ceil(n / multiple) * multiple;
}

/**
 * RGBA pixels (0–255) → planar CHW RGB float32 in [0,1], the shape LaMa's
 * "image" input expects ([1,3,H,W] once wrapped in a tensor).
 */
export function toCHW(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const plane = w * h;
  const out = new Float32Array(3 * plane);
  for (let i = 0, p = 0; p < plane; i += 4, p++) {
    out[p] = rgba[i] / 255;
    out[plane + p] = rgba[i + 1] / 255;
    out[2 * plane + p] = rgba[i + 2] / 255;
  }
  return out;
}

/**
 * Mask RGBA → single-channel float32 (1 where painted, else 0). The brush paints
 * with alpha, so a pixel counts as masked when its alpha is set.
 */
export function toMaskChannel(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const plane = w * h;
  const out = new Float32Array(plane);
  for (let i = 0, p = 0; p < plane; i += 4, p++) {
    out[p] = rgba[i + 3] > 10 ? 1 : 0;
  }
  return out;
}

/**
 * LaMa "output" (planar CHW, 0–255) → RGBA (0–255). Uint8ClampedArray clamps
 * out-of-range values automatically.
 */
export function fromCHW(out: Float32Array, w: number, h: number): Uint8ClampedArray {
  const plane = w * h;
  const rgba = new Uint8ClampedArray(plane * 4);
  for (let p = 0, i = 0; p < plane; p++, i += 4) {
    rgba[i] = out[p];
    rgba[i + 1] = out[plane + p];
    rgba[i + 2] = out[2 * plane + p];
    rgba[i + 3] = 255;
  }
  return rgba;
}
