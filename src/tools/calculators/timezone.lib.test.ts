import { describe, it, expect } from 'vitest';
import { offsetMs, offsetLabel, wallTimeToInstant, formatInZone } from './timezone.lib';

describe('timezone', () => {
  it('knows fixed offsets', () => {
    // Jakarta is a fixed +7 with no DST.
    expect(offsetMs(0, 'Asia/Jakarta')).toBe(7 * 3600000);
    expect(offsetMs(0, 'UTC')).toBe(0);
    expect(offsetMs(0, 'Asia/Kolkata')).toBe(5.5 * 3600000);
  });

  it('formats a GMT offset label', () => {
    expect(offsetLabel(0, 'Asia/Jakarta')).toBe('GMT+7');
    expect(offsetLabel(0, 'Asia/Kolkata')).toBe('GMT+5:30');
    expect(offsetLabel(0, 'UTC')).toBe('GMT+0');
  });

  it('round-trips a wall time through an instant (fixed-offset zone)', () => {
    // 09:00 in Jakarta = 02:00 UTC.
    const instant = wallTimeToInstant(2026, 8, 18, 9, 0, 'Asia/Jakarta');
    expect(new Date(instant).toISOString()).toBe('2026-08-18T02:00:00.000Z');
  });

  it('converts a wall time across zones', () => {
    // 09:00 Jakarta shown in UTC should read 02:00.
    const instant = wallTimeToInstant(2026, 8, 18, 9, 0, 'Asia/Jakarta');
    expect(formatInZone(instant, 'UTC')).toMatch(/02:00/);
  });

  it('handles a US DST wall time (New York, summer = -4)', () => {
    const instant = wallTimeToInstant(2026, 7, 1, 12, 0, 'America/New_York');
    expect(new Date(instant).toISOString()).toBe('2026-07-01T16:00:00.000Z');
  });
});
