import { describe, it, expect } from 'vitest';
import {
  SETS,
  AMBIGUOUS,
  buildPool,
  generatePassword,
  strengthLabel,
  type SetKey,
} from './password.lib';

const allEnabled: Record<SetKey, boolean> = {
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
};

const noneEnabled: Record<SetKey, boolean> = {
  lowercase: false,
  uppercase: false,
  numbers: false,
  symbols: false,
};

describe('buildPool', () => {
  it('includes every set when all are enabled', () => {
    const pool = buildPool(allEnabled, false);
    for (const char of SETS.lowercase) expect(pool).toContain(char);
    for (const char of SETS.uppercase) expect(pool).toContain(char);
    for (const char of SETS.numbers) expect(pool).toContain(char);
    for (const char of SETS.symbols) expect(pool).toContain(char);
  });

  it('equals just the lowercase set when only lowercase is enabled', () => {
    const pool = buildPool({ ...noneEnabled, lowercase: true }, false);
    expect(pool).toBe(SETS.lowercase);
  });

  it('excludes every ambiguous character when avoidAmbiguous is true', () => {
    const pool = buildPool(allEnabled, true);
    for (const char of AMBIGUOUS) expect(pool).not.toContain(char);
  });

  it('returns an empty string when no sets are enabled', () => {
    expect(buildPool(noneEnabled, false)).toBe('');
  });
});

describe('generatePassword', () => {
  it('returns a string of the requested length', () => {
    for (let iter = 0; iter < 50; iter++) {
      const pw = generatePassword({
        length: 16,
        enabled: allEnabled,
        avoidAmbiguous: false,
        minNumbers: 1,
        minSpecial: 1,
      });
      expect(pw).toHaveLength(16);
    }
  });

  it('only uses characters from the enabled pool', () => {
    const enabled: Record<SetKey, boolean> = { ...noneEnabled, lowercase: true, numbers: true };
    const pool = buildPool(enabled, false);
    for (let iter = 0; iter < 50; iter++) {
      const pw = generatePassword({
        length: 20,
        enabled,
        avoidAmbiguous: false,
        minNumbers: 1,
        minSpecial: 0,
      });
      for (const char of pw) expect(pool).toContain(char);
    }
  });

  it('contains no ambiguous characters when avoidAmbiguous is true', () => {
    for (let iter = 0; iter < 50; iter++) {
      const pw = generatePassword({
        length: 24,
        enabled: allEnabled,
        avoidAmbiguous: true,
        minNumbers: 2,
        minSpecial: 2,
      });
      for (const char of AMBIGUOUS) expect(pw).not.toContain(char);
    }
  });

  it('guarantees at least one lowercase and one uppercase when both enabled', () => {
    for (let iter = 0; iter < 50; iter++) {
      const pw = generatePassword({
        length: 12,
        enabled: allEnabled,
        avoidAmbiguous: false,
        minNumbers: 1,
        minSpecial: 1,
      });
      expect([...pw].some(c => SETS.lowercase.includes(c))).toBe(true);
      expect([...pw].some(c => SETS.uppercase.includes(c))).toBe(true);
    }
  });

  it('guarantees at least minNumbers digits and minSpecial specials', () => {
    const minNumbers = 3;
    const minSpecial = 2;
    for (let iter = 0; iter < 50; iter++) {
      const pw = generatePassword({
        length: 20,
        enabled: allEnabled,
        avoidAmbiguous: false,
        minNumbers,
        minSpecial,
      });
      const digits = [...pw].filter(c => SETS.numbers.includes(c)).length;
      const specials = [...pw].filter(c => SETS.symbols.includes(c)).length;
      expect(digits).toBeGreaterThanOrEqual(minNumbers);
      expect(specials).toBeGreaterThanOrEqual(minSpecial);
    }
  });

  it('returns an empty string when the pool is empty (all sets disabled)', () => {
    const pw = generatePassword({
      length: 16,
      enabled: noneEnabled,
      avoidAmbiguous: false,
      minNumbers: 1,
      minSpecial: 1,
    });
    expect(pw).toBe('');
  });
});

describe('strengthLabel', () => {
  it('returns Weak for tiny entropy', () => {
    expect(strengthLabel(1, 2).label).toBe('Weak');
  });

  it('returns Very strong for large length and pool size', () => {
    expect(strengthLabel(64, 94).label).toBe('Very strong');
  });
});
