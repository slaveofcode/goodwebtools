import { describe, it, expect } from 'vitest';
import { describeDate, parseTimestamp } from './timestamp.lib';

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
