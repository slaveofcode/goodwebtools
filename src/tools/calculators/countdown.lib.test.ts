import { describe, it, expect } from 'vitest';
import { breakdown, daysUntil, businessDaysUntil } from './countdown.lib';

describe('countdown', () => {
  it('breaks a future gap into d/h/m/s', () => {
    const from = 0;
    const to = ((2 * 24 + 3) * 60 + 4) * 60 * 1000 + 5000; // 2d 3h 4m 5s
    const b = breakdown(from, to);
    expect(b).toMatchObject({ past: false, days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it('flags a past target', () => {
    expect(breakdown(1000, 0).past).toBe(true);
  });

  it('daysUntil ignores time of day', () => {
    const a = new Date('2026-08-18T23:00:00');
    const b = new Date('2026-08-20T01:00:00');
    expect(daysUntil(a, b)).toBe(2);
  });

  it('daysUntil is negative for past dates', () => {
    expect(daysUntil(new Date('2026-08-20'), new Date('2026-08-18'))).toBe(-2);
  });

  it('daysUntil is 0 for the same day', () => {
    expect(daysUntil(new Date('2026-08-18T08:00'), new Date('2026-08-18T20:00'))).toBe(0);
  });

  it('businessDaysUntil excludes weekends', () => {
    // 2026-08-17 is a Monday; to Monday 2026-08-24 = 5 business days.
    expect(businessDaysUntil(new Date('2026-08-17'), new Date('2026-08-24'))).toBe(5);
  });
});
