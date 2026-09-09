import { describe, it, expect } from 'vitest';
import { clockReadout, zoneOffsetLabel, listTimeZones, detectTimeZone } from './clock.lib';

// A fixed instant: 2026-09-09T07:07:32.418726Z
// (07:07:32.418 UTC → 14:07:32.418 in Asia/Jakarta, UTC+7).
const EPOCH = Date.UTC(2026, 8, 9, 7, 7, 32) + 418.726;

describe('clockReadout', () => {
  it('renders 24-hour time in UTC with ms + µs', () => {
    const r = clockReadout(EPOCH, 'UTC', false);
    expect(`${r.hh}:${r.mm}:${r.ss}`).toBe('07:07:32');
    expect(r.millis).toBe('418');
    expect(r.micros).toBe('726');
    expect(r.dayPeriod).toBe('');
    expect(r.offsetLabel).toBe('UTC');
  });

  it('applies the target time zone offset', () => {
    const r = clockReadout(EPOCH, 'Asia/Jakarta', false);
    expect(`${r.hh}:${r.mm}:${r.ss}`).toBe('14:07:32');
    expect(r.offsetLabel).toBe('UTC+7');
  });

  it('renders 12-hour time with a day period', () => {
    const r = clockReadout(EPOCH, 'Asia/Jakarta', true, 'en-US');
    expect(r.hh).toBe('02'); // 14:07 → 2 PM
    expect(r.dayPeriod).toMatch(/PM/i);
  });

  it('exposes epoch seconds and whole milliseconds', () => {
    const r = clockReadout(EPOCH, 'UTC', false);
    expect(r.epochMs).toBe(Math.floor(EPOCH));
    expect(r.epochSec).toBe(Math.floor(EPOCH / 1000));
  });

  it('zero-pads sub-second fields and includes a date label', () => {
    const r = clockReadout(Date.UTC(2026, 0, 1, 0, 0, 0) + 5.009, 'UTC', false);
    expect(r.millis).toBe('005');
    expect(r.micros).toBe('009');
    expect(r.dateLabel).toContain('2026');
  });
});

describe('zoneOffsetLabel', () => {
  it('normalises GMT to UTC and keeps fractional offsets', () => {
    const d = new Date(EPOCH);
    expect(zoneOffsetLabel(d, 'UTC')).toBe('UTC');
    expect(zoneOffsetLabel(d, 'Asia/Kolkata')).toBe('UTC+05:30');
  });
});

describe('listTimeZones / detectTimeZone', () => {
  it('returns a non-empty zone list including a known zone', () => {
    const zones = listTimeZones();
    expect(zones.length).toBeGreaterThan(0);
    expect(zones).toContain('Asia/Jakarta');
    expect(zones).toContain('UTC');
  });

  it('detects a valid IANA-looking zone string', () => {
    expect(typeof detectTimeZone()).toBe('string');
    expect(detectTimeZone().length).toBeGreaterThan(0);
  });
});
