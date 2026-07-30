import { describe, it, expect } from 'vitest';
import { applyCleanup, rotate90, crop } from './ocr-preprocess.lib';

// Plain ImageData is enough in jsdom — transforms only read width/height/data.
function makeImageData(width: number, height: number, px: number[][]): ImageData {
  const data = new Uint8ClampedArray(px.length * 4);
  px.forEach(([r, g, b, a], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a ?? 255;
  });
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

describe('applyCleanup', () => {
  it('grayscales when no threshold (R=G=B, alpha kept)', () => {
    const out = applyCleanup(makeImageData(2, 1, [[255, 0, 0, 255], [0, 0, 255, 128]]));
    expect(out.data[0]).toBe(out.data[1]);
    expect(out.data[1]).toBe(out.data[2]);
    expect(out.data[3]).toBe(255);
    expect(out.data[7]).toBe(128); // alpha preserved
  });

  it('binarizes to 0/255 when a threshold is given', () => {
    const out = applyCleanup(makeImageData(2, 1, [[100, 100, 100, 255], [200, 200, 200, 255]]), { threshold: 128 });
    expect(out.data[0]).toBe(0);   // lum 100 < 128
    expect(out.data[4]).toBe(255); // lum 200 >= 128
  });
});

describe('rotate90', () => {
  it('turns a 2x1 into a 1x2 and moves pixels clockwise', () => {
    // source row: [A=red, B=green]; 90° CW -> column top=A, bottom=B
    const src = makeImageData(2, 1, [[255, 0, 0, 255], [0, 255, 0, 255]]);
    const out = rotate90(src);
    expect(out.width).toBe(1);
    expect(out.height).toBe(2);
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([255, 0, 0]); // top = A
    expect([out.data[4], out.data[5], out.data[6]]).toEqual([0, 255, 0]); // bottom = B
  });

  it('applied four times returns the original', () => {
    const src = makeImageData(2, 1, [[1, 2, 3, 255], [4, 5, 6, 255]]);
    let out = src;
    for (let i = 0; i < 4; i++) out = rotate90(out);
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });
});

describe('crop', () => {
  it('copies the requested sub-rectangle', () => {
    // 2x2: TL=1,TR=2,BL=3,BR=4 (red channel encodes id)
    const src = makeImageData(2, 2, [[1, 0, 0, 255], [2, 0, 0, 255], [3, 0, 0, 255], [4, 0, 0, 255]]);
    const out = crop(src, { x: 1, y: 0, width: 1, height: 2 }); // right column
    expect(out.width).toBe(1);
    expect(out.height).toBe(2);
    expect(out.data[0]).toBe(2); // TR
    expect(out.data[4]).toBe(4); // BR
  });

  it('clamps a region that exceeds bounds', () => {
    const src = makeImageData(2, 1, [[1, 0, 0, 255], [2, 0, 0, 255]]);
    const out = crop(src, { x: 0, y: 0, width: 99, height: 99 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
  });
});
