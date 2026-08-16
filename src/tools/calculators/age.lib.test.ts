import { describe, it, expect } from 'vitest';
import { parseISODate, ageParts, ageTotals, nextBirthday } from './age.lib';

const D = (s: string) => parseISODate(s)!;

describe('parseISODate', () => {
  it('parses a valid ISO date at UTC midnight', () => {
    const d = parseISODate('2000-01-15')!;
    expect(d.getUTCFullYear()).toBe(2000);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(0);
  });
  it('returns null for junk', () => {
    expect(parseISODate('')).toBeNull();
    expect(parseISODate('2000-13-40')).toBeNull();
    expect(parseISODate('not-a-date')).toBeNull();
  });
});

describe('ageParts', () => {
  it('whole years', () => {
    expect(ageParts(D('2000-01-01'), D('2024-01-01'))).toEqual({ years: 24, months: 0, days: 0 });
  });
  it('borrows days across a month boundary', () => {
    expect(ageParts(D('2000-01-15'), D('2024-01-10'))).toEqual({ years: 23, months: 11, days: 26 });
  });
  it('same day is zero', () => {
    expect(ageParts(D('1990-06-01'), D('1990-06-01'))).toEqual({ years: 0, months: 0, days: 0 });
  });
  it('handles a leap-day birthday', () => {
    expect(ageParts(D('2020-02-29'), D('2021-02-28'))).toEqual({ years: 0, months: 11, days: 30 });
  });
});

describe('ageTotals', () => {
  it('counts elapsed days, weeks and hours', () => {
    expect(ageTotals(D('2000-01-01'), D('2000-01-08'))).toEqual({ days: 7, weeks: 1, months: 0, hours: 168 });
  });
  it('total months equals years*12 + months', () => {
    expect(ageTotals(D('2000-01-15'), D('2024-01-10')).months).toBe(23 * 12 + 11);
  });
});

describe('nextBirthday', () => {
  it('finds an upcoming birthday later this year', () => {
    const nb = nextBirthday(D('1990-08-17'), D('2024-06-01'));
    expect(nb.turning).toBe(34);
    expect(nb.inDays).toBe(77); // Jun 1 -> Aug 17, 2024
  });
  it('rolls to next year when the birthday already passed', () => {
    const nb = nextBirthday(D('1990-03-01'), D('2024-06-01'));
    expect(nb.turning).toBe(35);
    expect(nb.inDays).toBeGreaterThan(0);
  });
  it('reports the birth weekday (0=Sun..6=Sat)', () => {
    // 1990-08-17 was a Friday
    expect(nextBirthday(D('1990-08-17'), D('2024-06-01')).weekday).toBe(5);
  });
});
