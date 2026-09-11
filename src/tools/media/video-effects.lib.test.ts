import { describe, it, expect } from 'vitest';
import { filterCss, hexToRgb, applyChromaKey, FILTER_CSS } from './video-effects.lib';

describe('filterCss', () => {
  it('maps presets to CSS filter strings', () => {
    expect(filterCss('none')).toBe('none');
    expect(filterCss('grayscale')).toBe('grayscale(1)');
    expect(filterCss('invert')).toBe('invert(1)');
  });
  it('covers every preset', () => {
    for (const k of Object.keys(FILTER_CSS)) expect(typeof filterCss(k as never)).toBe('string');
  });
});

describe('hexToRgb', () => {
  it.each([
    ['#00b140', { r: 0, g: 177, b: 64 }],
    ['#fff', { r: 255, g: 255, b: 255 }],
    ['000000', { r: 0, g: 0, b: 0 }],
    ['nothex', { r: 0, g: 0, b: 0 }],
  ])('%s', (hex, rgb) => expect(hexToRgb(hex)).toEqual(rgb));
});

describe('applyChromaKey', () => {
  it('zeroes alpha for pixels near the key color and keeps others', () => {
    // pixel 0: pure green (key) → removed; pixel 1: red → kept.
    const data = new Uint8ClampedArray([0, 177, 64, 255, 255, 0, 0, 255]);
    applyChromaKey(data, { r: 0, g: 177, b: 64 }, 40);
    expect(data[3]).toBe(0);   // green pixel now transparent
    expect(data[7]).toBe(255); // red pixel untouched
  });

  it('threshold widens the match', () => {
    const near = new Uint8ClampedArray([20, 190, 80, 255]); // close-ish to key
    applyChromaKey(near, { r: 0, g: 177, b: 64 }, 10);
    expect(near[3]).toBe(255); // too far for a tight threshold
    const near2 = new Uint8ClampedArray([20, 190, 80, 255]);
    applyChromaKey(near2, { r: 0, g: 177, b: 64 }, 60);
    expect(near2[3]).toBe(0); // within a loose threshold
  });
});
