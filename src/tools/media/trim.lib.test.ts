import { describe, it, expect } from 'vitest';
import { parseTime, formatTime, validateTrim, clampTrim } from './trim.lib';

describe('parseTime', () => {
  it.each([
    ['83', 83],
    ['1:23', 83],
    ['1:23.5', 83.5],
    ['01:02:03', 3723],
    ['0:05', 5],
    ['12', 12],
  ])('parses %s → %d', (input, expected) => {
    expect(parseTime(input)).toBe(expected);
  });

  it.each(['', 'abc', '1:60', '1:2:60', '1:99', ':30', '1:2:3:4'])('rejects %s', (input) => {
    expect(parseTime(input)).toBeNull();
  });
});

describe('formatTime', () => {
  it.each([
    [83, '1:23'],
    [83.5, '1:23.5'],
    [3723, '1:02:03'],
    [5, '0:05'],
    [0, '0:00'],
    [-4, '0:00'],
  ])('formats %d → %s', (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });
});

describe('validateTrim', () => {
  it('accepts a normal in-bounds range', () => {
    expect(validateTrim({ start: 0, end: 10, duration: 60 })).toEqual({ ok: true });
  });
  it('rejects end <= start', () => {
    expect(validateTrim({ start: 10, end: 5, duration: 60 }).error).toBe('range');
  });
  it('rejects out-of-bounds end', () => {
    expect(validateTrim({ start: 0, end: 100, duration: 60 }).error).toBe('bounds');
  });
  it('rejects a too-short selection', () => {
    expect(validateTrim({ start: 1, end: 1.05, duration: 60 }).error).toBe('tooShort');
  });
});

describe('clampTrim', () => {
  it('orders and clamps into [0, duration]', () => {
    expect(clampTrim(-5, 80, 60)).toEqual({ start: 0, end: 60 });
    expect(clampTrim(40, 10, 60)).toEqual({ start: 10, end: 40 });
  });
});
