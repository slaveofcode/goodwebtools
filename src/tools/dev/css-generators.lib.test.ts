import { describe, it, expect } from 'vitest';
import { linearGradientCss, radialGradientCss, boxShadowCss, borderRadiusCss } from './css-generators.lib';

describe('gradients', () => {
  const stops = [{ color: '#ffffff', pos: 0 }, { color: '#000000', pos: 100 }];
  it('builds a linear gradient', () => {
    expect(linearGradientCss(90, stops)).toBe('linear-gradient(90deg, #ffffff 0%, #000000 100%)');
  });
  it('builds a radial gradient', () => {
    expect(radialGradientCss('circle', stops)).toBe('radial-gradient(circle, #ffffff 0%, #000000 100%)');
  });
});

describe('boxShadowCss', () => {
  it('composes offsets, blur, spread and color', () => {
    expect(boxShadowCss({ x: 2, y: 4, blur: 8, spread: 0, color: 'rgba(0,0,0,0.3)', inset: false }))
      .toBe('2px 4px 8px 0px rgba(0,0,0,0.3)');
  });
  it('prefixes inset', () => {
    expect(boxShadowCss({ x: 0, y: 0, blur: 5, spread: 1, color: '#333', inset: true }))
      .toBe('inset 0px 0px 5px 1px #333');
  });
});

describe('borderRadiusCss', () => {
  it('collapses equal corners to one value', () => {
    expect(borderRadiusCss(8, 8, 8, 8)).toBe('8px');
  });
  it('lists four corners when they differ', () => {
    expect(borderRadiusCss(4, 8, 12, 16)).toBe('4px 8px 12px 16px');
  });
});
