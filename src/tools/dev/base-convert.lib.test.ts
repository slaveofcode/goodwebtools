import { describe, it, expect } from 'vitest';
import { parseInBase, DIGITS } from './base-convert.lib';

describe('parseInBase', () => {
  it('parses a base-10 number', () => {
    expect(parseInBase('255', 10)).toBe(255n);
  });

  it('parses a base-16 number', () => {
    expect(parseInBase('ff', 16)).toBe(255n);
  });

  it('strips a 0x prefix in base 16', () => {
    expect(parseInBase('0xff', 16)).toBe(255n);
  });

  it('strips a 0b prefix in base 2', () => {
    expect(parseInBase('0b1010', 2)).toBe(10n);
  });

  it('parses a base-2 number', () => {
    expect(parseInBase('1010', 2)).toBe(10n);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseInBase('  FF  ', 16)).toBe(255n);
  });

  it('returns null for a digit invalid in the given base', () => {
    expect(parseInBase('2', 2)).toBeNull();
    expect(parseInBase('g', 16)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseInBase('', 10)).toBeNull();
    expect(parseInBase('   ', 10)).toBeNull();
  });

  it('handles very large numbers without precision loss', () => {
    const big = '99999999999999999999999999999999';
    expect(parseInBase(big, 10)).toBe(99999999999999999999999999999999n);
    // Beyond Number.MAX_SAFE_INTEGER, BigInt keeps every digit exact.
    expect(parseInBase('9007199254740993', 10)).toBe(9007199254740993n);
  });

  it('exposes the digit alphabet', () => {
    expect(DIGITS).toBe('0123456789abcdefghijklmnopqrstuvwxyz');
  });
});
