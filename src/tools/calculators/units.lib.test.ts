import { describe, it, expect } from 'vitest';
import { UNIT_CATEGORIES, convert, formatNumber, getCategory } from './units.lib';

describe('convert — linear', () => {
  it('length: 1 mile = 1609.344 m', () => {
    expect(convert('length', 1, 'mi', 'm')).toBeCloseTo(1609.344, 6);
  });
  it('length: 100 cm = 1 m', () => {
    expect(convert('length', 100, 'cm', 'm')).toBeCloseTo(1, 12);
  });
  it('mass: 1 kg ≈ 2.2046226 lb', () => {
    expect(convert('mass', 1, 'kg', 'lb')).toBeCloseTo(2.2046226, 6);
  });
  it('digital: 1 GiB = 1073741824 byte', () => {
    expect(convert('digital', 1, 'GiB', 'B')).toBe(1073741824);
  });
  it('same unit is identity', () => {
    expect(convert('volume', 3.5, 'l', 'l')).toBe(3.5);
  });
  it('round-trips within tolerance', () => {
    const there = convert('speed', 65, 'mph', 'kmh');
    expect(convert('speed', there, 'kmh', 'mph')).toBeCloseTo(65, 9);
  });
});

describe('convert — temperature (affine)', () => {
  it('100 °C = 212 °F', () => {
    expect(convert('temperature', 100, 'C', 'F')).toBeCloseTo(212, 9);
  });
  it('0 °C = 273.15 K', () => {
    expect(convert('temperature', 0, 'C', 'K')).toBeCloseTo(273.15, 9);
  });
  it('32 °F = 0 °C', () => {
    expect(convert('temperature', 32, 'F', 'C')).toBeCloseTo(0, 9);
  });
});

describe('convert — guards', () => {
  it('unknown category throws', () => {
    expect(() => convert('nope', 1, 'a', 'b')).toThrow();
  });
  it('unknown unit throws', () => {
    expect(() => convert('length', 1, 'm', 'parsec')).toThrow();
  });
});

describe('getCategory / registry', () => {
  it('exposes several categories each with ≥2 units', () => {
    expect(UNIT_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    for (const c of UNIT_CATEGORIES) expect(c.units.length).toBeGreaterThanOrEqual(2);
  });
  it('looks a category up by id', () => {
    expect(getCategory('length')?.units.some(u => u.id === 'km')).toBe(true);
  });
});

describe('formatNumber', () => {
  it('trims trailing zeros', () => {
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(1.5)).toBe('1.5');
  });
  it('keeps precision for small values', () => {
    expect(Number(formatNumber(0.0254))).toBeCloseTo(0.0254, 12);
  });
  it('handles large values without scientific noise for readable ranges', () => {
    expect(formatNumber(1609.344)).toBe('1609.344');
  });
});
