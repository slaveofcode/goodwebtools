import { describe, it, expect } from 'vitest';
import { toRoman, fromRoman, isValidRoman } from './roman.lib';

describe('roman', () => {
  it.each([
    [1, 'I'], [4, 'IV'], [9, 'IX'], [14, 'XIV'], [40, 'XL'], [90, 'XC'],
    [400, 'CD'], [900, 'CM'], [1994, 'MCMXCIV'], [2026, 'MMXXVI'], [3999, 'MMMCMXCIX'],
  ])('toRoman(%i) = %s', (n, r) => {
    expect(toRoman(n)).toBe(r);
  });

  it('round-trips every value in range for a sample', () => {
    for (const n of [1, 58, 444, 1000, 2468, 3999]) expect(fromRoman(toRoman(n))).toBe(n);
  });

  it('fromRoman is case-insensitive', () => {
    expect(fromRoman('mcmxciv')).toBe(1994);
  });

  it('rejects out-of-range numbers', () => {
    expect(() => toRoman(0)).toThrow();
    expect(() => toRoman(4000)).toThrow();
    expect(() => toRoman(3.5)).toThrow();
  });

  it('rejects malformed numerals', () => {
    expect(() => fromRoman('IIII')).toThrow();
    expect(() => fromRoman('IC')).toThrow();
    expect(() => fromRoman('ABC')).toThrow();
    expect(() => fromRoman('')).toThrow();
  });

  it('isValidRoman reflects validity', () => {
    expect(isValidRoman('XIV')).toBe(true);
    expect(isValidRoman('IIII')).toBe(false);
  });
});
