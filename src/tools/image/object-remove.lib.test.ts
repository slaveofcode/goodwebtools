import { describe, it, expect } from 'vitest';
import { roundUpTo, toCHW, toMaskChannel, fromCHW } from './object-remove.lib';

describe('roundUpTo', () => {
  it('rounds up to a multiple of 8', () => {
    expect(roundUpTo(512, 8)).toBe(512);
    expect(roundUpTo(513, 8)).toBe(520);
    expect(roundUpTo(1, 8)).toBe(8);
  });
});

describe('toCHW', () => {
  it('splits RGBA into planar CHW and normalizes to [0,1]', () => {
    // 2 pixels: (255,0,0,255) red, (0,128,255,255)
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 128, 255, 255]);
    const out = toCHW(rgba, 2, 1);
    // R plane, then G plane, then B plane
    expect(out[0]).toBeCloseTo(1); // R px0
    expect(out[1]).toBeCloseTo(0); // R px1
    expect(out[2]).toBeCloseTo(0); // G px0
    expect(out[3]).toBeCloseTo(128 / 255); // G px1
    expect(out[4]).toBeCloseTo(0); // B px0
    expect(out[5]).toBeCloseTo(1); // B px1
  });
});

describe('toMaskChannel', () => {
  it('marks painted (alpha>10) pixels as 1', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 0, 255, 0, 0, 255]); // px0 alpha 0, px1 alpha 255
    expect(Array.from(toMaskChannel(rgba, 2, 1))).toEqual([0, 1]);
  });
});

describe('fromCHW', () => {
  it('recombines planar CHW (0–255) into opaque RGBA', () => {
    // 1 pixel: R=10, G=20, B=30
    const out = new Float32Array([10, 20, 30]);
    expect(Array.from(fromCHW(out, 1, 1))).toEqual([10, 20, 30, 255]);
  });

  it('clamps out-of-range values', () => {
    const out = new Float32Array([300, -5, 128]);
    expect(Array.from(fromCHW(out, 1, 1))).toEqual([255, 0, 128, 255]);
  });

  it('round-trips through toCHW → fromCHW (scaled)', () => {
    const rgba = new Uint8ClampedArray([12, 34, 56, 255]);
    const chw01 = toCHW(rgba, 1, 1);
    const chw255 = chw01.map(v => v * 255);
    expect(Array.from(fromCHW(chw255, 1, 1))).toEqual([12, 34, 56, 255]);
  });
});
