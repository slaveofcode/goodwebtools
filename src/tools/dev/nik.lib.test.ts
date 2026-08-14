import { describe, it, expect } from 'vitest';
import { parseNik, PROVINCES } from './nik.lib';

// 31 (DKI Jakarta) 75 71 | 17 08 90 | 0001  → male, born 1990-08-17
const MALE = '3175711708900001';
// same but female: day 17 + 40 = 57
const FEMALE = '3175715708900001';

describe('parseNik', () => {
  it('decodes a valid male NIK', () => {
    const r = parseNik(MALE, 2026);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.provinceCode).toBe('31');
    expect(r.province).toBe('DKI Jakarta');
    expect(r.regencyCode).toBe('75');
    expect(r.districtCode).toBe('71');
    expect(r.gender).toBe('male');
    expect(r.birthDate).toEqual({ day: 17, month: 8, year: 1990 });
    expect(r.birthDateISO).toBe('1990-08-17');
    expect(r.serial).toBe('0001');
  });

  it('detects female via the day+40 rule and corrects the day', () => {
    const r = parseNik(FEMALE, 2026);
    expect(r.gender).toBe('female');
    expect(r.birthDate).toEqual({ day: 17, month: 8, year: 1990 });
    expect(r.valid).toBe(true);
  });

  it('applies the century heuristic against currentYear', () => {
    // yy=05 with currentYear 2026 → 2005 (not in the future)
    expect(parseNik('3175711703050001', 2026).birthDate!.year).toBe(2005);
    // yy=99 → 2099 is in the future → 1999
    expect(parseNik('3175711703990001', 2026).birthDate!.year).toBe(1999);
  });

  it('ignores spaces and dots in the input', () => {
    expect(parseNik('3175 7117 0890 0001', 2026).valid).toBe(true);
  });

  it('flags a wrong length', () => {
    const r = parseNik('317571170890', 2026);
    expect(r.valid).toBe(false);
    expect(r.issues.join(' ')).toMatch(/16/);
  });

  it('flags non-digits', () => {
    expect(parseNik('31757117089000AB', 2026).valid).toBe(false);
  });

  it('flags an impossible month and day', () => {
    expect(parseNik('3175711713900001', 2026).issues.join(' ')).toMatch(/month/i);
    expect(parseNik('3175710008900001', 2026).issues.join(' ')).toMatch(/day/i);
  });

  it('flags an unknown province but still parses', () => {
    const r = parseNik('0075711708900001', 2026);
    expect(r.province).toBe('');
    expect(r.issues.join(' ')).toMatch(/province/i);
  });

  it('exposes the province table', () => {
    expect(PROVINCES['32']).toBe('Jawa Barat');
    expect(Object.keys(PROVINCES).length).toBeGreaterThanOrEqual(34);
  });
});
