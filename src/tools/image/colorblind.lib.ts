/**
 * Pure colour-vision-deficiency simulation via 3×3 RGB matrices. Each matrix row
 * sums to 1 so greys/white/black are preserved. Matrices are the widely used
 * dichromacy approximations (as in Coblis / GIMP). No I/O.
 */

export interface CvdType {
  id: string;
  name: string;
  matrix: number[]; // row-major 3×3
}

export const CVD_TYPES: CvdType[] = [
  { id: 'protanopia', name: 'Protanopia (no red)', matrix: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758] },
  { id: 'protanomaly', name: 'Protanomaly (weak red)', matrix: [0.817, 0.183, 0, 0.333, 0.667, 0, 0, 0.125, 0.875] },
  { id: 'deuteranopia', name: 'Deuteranopia (no green)', matrix: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7] },
  { id: 'deuteranomaly', name: 'Deuteranomaly (weak green)', matrix: [0.8, 0.2, 0, 0.258, 0.742, 0, 0, 0.142, 0.858] },
  { id: 'tritanopia', name: 'Tritanopia (no blue)', matrix: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525] },
  { id: 'tritanomaly', name: 'Tritanomaly (weak blue)', matrix: [0.967, 0.033, 0, 0, 0.733, 0.267, 0, 0.183, 0.817] },
  { id: 'achromatopsia', name: 'Achromatopsia (no colour)', matrix: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114] },
];

const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function simulateRGB(rgb: [number, number, number], typeId: string): [number, number, number] {
  const type = CVD_TYPES.find(t => t.id === typeId);
  if (!type) return rgb;
  const [r, g, b] = rgb;
  const m = type.matrix;
  return [
    clampByte(m[0] * r + m[1] * g + m[2] * b),
    clampByte(m[3] * r + m[4] * g + m[5] * b),
    clampByte(m[6] * r + m[7] * g + m[8] * b),
  ];
}

/** Apply the simulation in place to an RGBA pixel buffer. */
export function simulateImageData(data: Uint8ClampedArray, typeId: string): void {
  const type = CVD_TYPES.find(t => t.id === typeId);
  if (!type) return;
  const m = type.matrix;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = clampByte(m[0] * r + m[1] * g + m[2] * b);
    data[i + 1] = clampByte(m[3] * r + m[4] * g + m[5] * b);
    data[i + 2] = clampByte(m[6] * r + m[7] * g + m[8] * b);
  }
}
