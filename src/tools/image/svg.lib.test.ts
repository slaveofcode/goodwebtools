import { describe, it, expect } from 'vitest';
import { parseSvgSize } from './svg.lib';

describe('parseSvgSize', () => {
  it('reads explicit width/height', () => {
    expect(parseSvgSize('<svg width="120" height="80"></svg>')).toMatchObject({ width: 120, height: 80 });
  });
  it('strips units like px', () => {
    expect(parseSvgSize('<svg width="120px" height="80px"></svg>')).toMatchObject({ width: 120, height: 80 });
  });
  it('derives size from viewBox when width/height absent', () => {
    const r = parseSvgSize('<svg viewBox="0 0 300 150"></svg>');
    expect(r).toMatchObject({ width: 300, height: 150, viewBox: [0, 0, 300, 150] });
  });
  it('falls back to 300x150 when nothing is specified', () => {
    expect(parseSvgSize('<svg></svg>')).toMatchObject({ width: 300, height: 150 });
  });
});
