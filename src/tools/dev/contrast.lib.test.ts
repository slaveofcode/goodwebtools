import { describe, it, expect } from 'vitest';
import { parseColor, relativeLuminance, contrastRatio, wcagLevels } from './contrast.lib';

describe('parseColor', () => {
  it('parses #rrggbb', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('parses shorthand #rgb', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('parses rgb()', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('returns null for junk', () => {
    expect(parseColor('nope')).toBeNull();
    expect(parseColor('#12')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });
});

describe('contrastRatio', () => {
  it('black on white is 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 2);
  });
  it('identical colors are 1:1', () => {
    expect(contrastRatio({ r: 120, g: 120, b: 120 }, { r: 120, g: 120, b: 120 })).toBeCloseTo(1, 5);
  });
  it('is symmetric', () => {
    const a = { r: 30, g: 60, b: 90 };
    const b = { r: 200, g: 200, b: 200 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 6);
  });
});

describe('wcagLevels', () => {
  it('21:1 passes everything', () => {
    expect(wcagLevels(21)).toEqual({ normalAA: true, normalAAA: true, largeAA: true, largeAAA: true });
  });
  it('4.5:1 passes normal AA and large AA/AAA but not normal AAA', () => {
    expect(wcagLevels(4.5)).toEqual({ normalAA: true, normalAAA: false, largeAA: true, largeAAA: true });
  });
  it('3:1 passes only large AA', () => {
    expect(wcagLevels(3)).toEqual({ normalAA: false, normalAAA: false, largeAA: true, largeAAA: false });
  });
  it('1:1 fails everything', () => {
    expect(wcagLevels(1)).toEqual({ normalAA: false, normalAAA: false, largeAA: false, largeAAA: false });
  });
});
