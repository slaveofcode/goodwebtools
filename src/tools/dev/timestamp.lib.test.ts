import { describe, it, expect } from 'vitest';
import {
  describeDate,
  parseTimestamp,
  formatInTimeZone,
  listTimeZones,
  getLocalTimeZone,
  parseDateTimeLocal,
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

describe('parseDateTimeLocal', () => {
  it('interprets a value as UTC', () => {
    // 2026-07-12T10:30:00Z is 1752316200 seconds.
    const d = parseDateTimeLocal('2026-07-12T10:30', 'utc')!;
    expect(d.toISOString()).toBe('2026-07-12T10:30:00.000Z');
  });

  it('includes seconds when present', () => {
    const d = parseDateTimeLocal('2026-07-12T10:30:15', 'utc')!;
    expect(d.toISOString()).toBe('2026-07-12T10:30:15.000Z');
  });

  it('interprets a value as local wall-clock time', () => {
    const d = parseDateTimeLocal('2026-07-12T10:30', 'local')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July (0-based)
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(30);
  });

  it('returns null for a malformed value', () => {
    expect(parseDateTimeLocal('', 'local')).toBeNull();
    expect(parseDateTimeLocal('not-a-date', 'utc')).toBeNull();
  });
});
