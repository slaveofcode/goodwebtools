import { describe, it, expect } from 'vitest';
import { formatStopwatch, formatCountdown, msUntilNext, msOfDay } from './stopwatch.lib';

describe('formatStopwatch', () => {
  it.each([
    [0, '0:00.00'],
    [1234, '0:01.23'],
    [61000, '1:01.00'],
    [3661000, '1:01:01.00'],
    [-50, '0:00.00'],
  ])('formats %d ms → %s', (ms, expected) => {
    expect(formatStopwatch(ms)).toBe(expected);
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, '0:00'],
    [5000, '0:05'],
    [4200, '0:05'],   // rounds up to the second
    [65000, '1:05'],
    [3661000, '1:01:01'],
  ])('formats %d ms → %s', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});

describe('msUntilNext', () => {
  const at = (h: number, m = 0) => (h * 60 + m) * 60_000;

  it('counts to a later time today', () => {
    expect(msUntilNext(at(10), 10, 30)).toBe(30 * 60_000);
  });
  it('rolls over to tomorrow when the time has passed', () => {
    expect(msUntilNext(at(10), 9, 0)).toBe(23 * 3600_000);
  });
  it('schedules exactly-now for the next day', () => {
    expect(msUntilNext(at(10), 10, 0)).toBe(86_400_000);
  });
});

describe('msOfDay', () => {
  it('reduces a Date to ms since local midnight', () => {
    const d = new Date(2026, 0, 1, 1, 2, 3, 500);
    expect(msOfDay(d)).toBe(((1 * 60 + 2) * 60 + 3) * 1000 + 500);
  });
});
