import { describe, it, expect } from 'vitest';
import {
  describeDate,
  parseTimestamp,
  formatInTimeZone,
  listTimeZones,
  getLocalTimeZone,
} from './timestamp.lib';

describe('parseTimestamp', () => {
  it('parses a 10-digit numeric string as Unix seconds', () => {
    const date = parseTimestamp('1700000000');
    expect(date).not.toBeNull();
    expect(Math.floor(date!.getTime() / 1000)).toBe(1700000000);
  });

  it('parses a 13-digit numeric string as Unix milliseconds', () => {
    const date = parseTimestamp('1700000000000');
    expect(date).not.toBeNull();
    expect(date!.getTime()).toBe(1700000000000);
  });

  it('parses an ISO date string', () => {
    const date = parseTimestamp('2026-07-12');
    expect(date).not.toBeNull();
    expect(date!.toISOString()).toBe('2026-07-12T00:00:00.000Z');
  });

  it('returns null for an unparseable string', () => {
    expect(parseTimestamp('not a date')).toBeNull();
  });
});

describe('describeDate', () => {
  it('describes the Unix epoch', () => {
    const result = describeDate(new Date(0));
    expect(result.unixSeconds).toBe(0);
    expect(result.unixMillis).toBe(0);
    expect(result.iso).toBe('1970-01-01T00:00:00.000Z');
  });

  it('returns all five representation fields', () => {
    const result = describeDate(new Date(1700000000000));
    expect(result.unixSeconds).toBe(1700000000);
    expect(result.unixMillis).toBe(1700000000000);
    expect(typeof result.utc).toBe('string');
    expect(typeof result.local).toBe('string');
  });
});

describe('formatInTimeZone', () => {
  const date = new Date('2026-07-12T09:36:00Z');

  it('formats a date in UTC', () => {
    const out = formatInTimeZone(date, 'UTC');
    expect(out).toContain('Jul 12, 2026');
    expect(out).toContain('9:36:00');
    expect(out).toMatch(/AM/);
  });

  it('applies the time zone offset (Tokyo = UTC+9)', () => {
    const out = formatInTimeZone(date, 'Asia/Tokyo');
    expect(out).toContain('6:36:00'); // 09:36 UTC + 9h = 18:36
    expect(out).toMatch(/PM/);
  });

  it('shifts the date across midnight (Los Angeles = UTC-7 in July)', () => {
    const out = formatInTimeZone(date, 'America/Los_Angeles');
    expect(out).toContain('2:36:00'); // 09:36 UTC - 7h = 02:36
    expect(out).toMatch(/AM/);
  });
});

describe('time zone helpers', () => {
  it('lists time zones including UTC', () => {
    const zones = listTimeZones();
    expect(Array.isArray(zones)).toBe(true);
    expect(zones.length).toBeGreaterThan(0);
    expect(zones).toContain('UTC');
  });

  it('returns a non-empty local time zone', () => {
    expect(typeof getLocalTimeZone()).toBe('string');
    expect(getLocalTimeZone().length).toBeGreaterThan(0);
  });
});
