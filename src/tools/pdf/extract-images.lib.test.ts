import { describe, it, expect } from 'vitest';
import { rgbToRgba } from './extract-images.lib';

describe('rgbToRgba', () => {
  it('expands RGB pixels to opaque RGBA', () => {
    const rgb = new Uint8Array([10, 20, 30, 40, 50, 60]); // 2 pixels
    expect(Array.from(rgbToRgba(rgb, 2))).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
  });

  it('returns the right length', () => {
    expect(rgbToRgba(new Uint8Array(300), 100)).toHaveLength(400);
  });
});
