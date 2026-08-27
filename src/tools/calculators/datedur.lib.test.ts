import { describe, it, expect } from 'vitest';
import { daysBetween, ymdBetween, addDays, businessDaysBetween } from './datedur.lib';

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
  });
  it('is negative when b precedes a', () => {
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(-7);
  });
  it('spans a leap day', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });
});

describe('ymdBetween', () => {
  it('breaks a span into y/m/d', () => {
    expect(ymdBetween('2026-01-15', '2026-03-20')).toEqual({ years: 0, months: 2, days: 5 });
  });
  it('borrows across a month when the end day is smaller', () => {
    // Jan 31 → Mar 1: 1 month (to Feb 28/29) leaves a couple of days.
    const r = ymdBetween('2026-01-31', '2026-03-01');
    expect(r.years).toBe(0);
    expect(r.months).toBe(1);
  });
  it('is order-independent', () => {
    expect(ymdBetween('2026-03-20', '2026-01-15')).toEqual({ years: 0, months: 2, days: 5 });
  });
  it('handles multi-year spans', () => {
    expect(ymdBetween('2020-06-10', '2023-06-10')).toEqual({ years: 3, months: 0, days: 0 });
  });
});

describe('addDays', () => {
  it('rolls over a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });
  it('subtracts with a negative offset', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('businessDaysBetween', () => {
  it('counts a full Mon–Fri week as 5', () => {
    expect(businessDaysBetween('2026-01-05', '2026-01-09')).toBe(5); // Mon–Fri
  });
  it('excludes the weekend', () => {
    expect(businessDaysBetween('2026-01-05', '2026-01-11')).toBe(5); // Mon–Sun
  });
});
