import { describe, it, expect } from 'vitest';
import { extractPalette, rgbToHex } from './palette.lib';

describe('rgbToHex', () => {
  it('pads channels', () => {
    expect(rgbToHex(255, 0, 16)).toBe('#ff0010');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });
});

/** Build RGBA data with `n` opaque pixels of one color. */
function pixels(color: [number, number, number], n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(color[0], color[1], color[2], 255);
  return out;
}

describe('extractPalette', () => {
  it('ranks colors by frequency', () => {
    const data = new Uint8ClampedArray([
      ...pixels([240, 0, 0], 10), // red — most common
      ...pixels([0, 240, 0], 4),  // green
      ...pixels([0, 0, 240], 1),  // blue
    ]);
    const p = extractPalette(data, 3, 1);
    expect(p[0].hex).toBe('#f00000');
    expect(p[0].count).toBe(10);
    expect(p.map(s => s.hex)).toEqual(['#f00000', '#00f000', '#0000f0']);
  });

  it('quantizes near-identical shades into one bucket', () => {
    const data = new Uint8ClampedArray([...pixels([241, 1, 1], 5), ...pixels([255, 15, 15], 5)]);
    const p = extractPalette(data, 5, 1);
    expect(p).toHaveLength(1);
    expect(p[0].count).toBe(10);
  });

  it('skips transparent pixels', () => {
    const data = new Uint8ClampedArray([240, 0, 0, 0, 0, 240, 0, 255]);
    const p = extractPalette(data, 5, 1);
    expect(p).toHaveLength(1);
    expect(p[0].hex).toBe('#00f000');
  });
});
