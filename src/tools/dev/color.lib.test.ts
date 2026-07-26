import { describe, it, expect } from 'vitest';
import { parseColor, toHex, toHsl } from './color.lib';

describe('parseColor', () => {
  it('parses a 6-digit hex', () => {
    expect(parseColor('#7c3aed')).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('parses a 6-digit hex without the leading #', () => {
    expect(parseColor('7c3aed')).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('expands a 3-digit hex', () => {
    expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('parses an rgb() string', () => {
    expect(parseColor('rgb(124, 58, 237)')).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('parses an rgba() string', () => {
    expect(parseColor('rgba(124, 58, 237, 0.5)')).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseColor('  #7C3AED  ')).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('returns null for invalid input', () => {
    expect(parseColor('not a color')).toBeNull();
    expect(parseColor('#12')).toBeNull();
    expect(parseColor('#zzzzzz')).toBeNull();
    expect(parseColor('')).toBeNull();
  });

  it('returns null when an rgb channel is out of range', () => {
    expect(parseColor('rgb(256, 0, 0)')).toBeNull();
  });
});

describe('toHex', () => {
  it('formats an rgb value', () => {
    expect(toHex({ r: 124, g: 58, b: 237 })).toBe('#7c3aed');
  });

  it('pads single-digit channels', () => {
    expect(toHex({ r: 0, g: 5, b: 15 })).toBe('#00050f');
  });

  it('round-trips with parseColor', () => {
    const rgb = parseColor('#7c3aed')!;
    expect(toHex(rgb)).toBe('#7c3aed');
    expect(parseColor(toHex(rgb))).toEqual(rgb);
  });
});

describe('toHsl', () => {
  it('converts pure red', () => {
    expect(toHsl({ r: 255, g: 0, b: 0 })).toBe('hsl(0, 100%, 50%)');
  });

  it('converts white', () => {
    expect(toHsl({ r: 255, g: 255, b: 255 })).toBe('hsl(0, 0%, 100%)');
  });

  it('converts black', () => {
    expect(toHsl({ r: 0, g: 0, b: 0 })).toBe('hsl(0, 0%, 0%)');
  });

  it('converts pure green', () => {
    expect(toHsl({ r: 0, g: 255, b: 0 })).toBe('hsl(120, 100%, 50%)');
  });

  it('converts pure blue', () => {
    expect(toHsl({ r: 0, g: 0, b: 255 })).toBe('hsl(240, 100%, 50%)');
  });
});
