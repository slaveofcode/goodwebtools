import { describe, it, expect } from 'vitest';
import { toGrayscale, toBlackWhite, toDitheredBW } from './mono.lib';

// Build a 2x2 ImageData without a real canvas (jsdom): plain object is enough
// because the transforms only read width/height/data.
function makeImageData(px: number[][]): ImageData {
  const data = new Uint8ClampedArray(px.length * 4);
  px.forEach(([r, g, b, a], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a ?? 255;
  });
  const side = Math.sqrt(px.length);
  return { width: side, height: side, data, colorSpace: 'srgb' } as ImageData;
}

describe('toGrayscale', () => {
  it('makes R=G=B per pixel using luminance weights', () => {
    const out = toGrayscale(makeImageData([[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255]]));
    for (let i = 0; i < 4; i++) {
      const [r, g, b] = [out.data[i * 4], out.data[i * 4 + 1], out.data[i * 4 + 2]];
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
    expect(out.data[0]).toBe(Math.round(0.299 * 255)); // red pixel luminance
  });
});

describe('toBlackWhite', () => {
  it('outputs only 0 or 255 and respects the threshold', () => {
    const out = toBlackWhite(makeImageData([[100, 100, 100, 255], [200, 200, 200, 255], [0, 0, 0, 255], [255, 255, 255, 255]]), 128);
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]);
    }
    expect(out.data[0]).toBe(0);   // lum 100 < 128 -> black
    expect(out.data[4]).toBe(255); // lum 200 >= 128 -> white
  });
});

describe('toDitheredBW', () => {
  it('outputs only 0 or 255 and preserves dimensions', () => {
    const out = toDitheredBW(makeImageData([[128, 128, 128, 255], [128, 128, 128, 255], [128, 128, 128, 255], [128, 128, 128, 255]]));
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]);
    }
  });
});
