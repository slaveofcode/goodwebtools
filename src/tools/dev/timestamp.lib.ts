export interface Parsed {
  unixSeconds: number;
  unixMillis: number;
  iso: string;
  utc: string;
  local: string;
}

export function describeDate(date: Date): Parsed {
  return {
    unixSeconds: Math.floor(date.getTime() / 1000),
    unixMillis: date.getTime(),
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toString(),
  };
}

/** Format a date in a given IANA time zone, e.g. "Jul 12, 2026, 6:36:00 PM GMT+9". */
export function formatInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'long',
  }).format(date);
}

/** The viewer's current IANA time zone, e.g. "Asia/Jakarta". */
export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

const FALLBACK_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/** All IANA time zones the runtime knows (UTC first), or a curated fallback. */
export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  let zones = FALLBACK_ZONES;
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      const supported = intl.supportedValuesOf('timeZone');
      if (supported.length) zones = supported;
    } catch {
      // fall through to fallback
    }
  }
  // Ensure a plain "UTC" entry exists and sits first.
  return ['UTC', ...zones.filter(zone => zone !== 'UTC')];
}

export type NumericUnit = 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds';

/** Convert a numeric epoch value in the given unit to milliseconds. */
const TO_MILLIS: Record<NumericUnit, (n: number) => number> = {
  seconds: n => n * 1000,
  milliseconds: n => n,
  microseconds: n => n / 1e3,
  nanoseconds: n => n / 1e6,
};

/**
 * Infer the epoch unit of an all-digits timestamp from its length. Tuned so
 * present-day values land on the right unit: ~10 digits = seconds,
 * ~13 = milliseconds, ~16 = microseconds, ~19 = nanoseconds. The seconds/millis
 * cutoffs (≤10, ≤13) match the tool's original behavior.
 */
export function detectNumericUnit(digits: string): NumericUnit {
  const len = digits.length;
  if (len <= 10) return 'seconds';
  if (len <= 13) return 'milliseconds';
  if (len <= 16) return 'microseconds';
  return 'nanoseconds';
}

export function parseTimestamp(input: string): Date | null {
  const trimmed = input.trim();
  let date: Date;
  if (/^\d+$/.test(trimmed)) {
    // Numeric epoch value: infer the unit (s/ms/µs/ns) from its digit length
    // and convert to milliseconds for the Date constructor. This lets us accept
    // high-resolution timestamps (e.g. 19-digit nanoseconds) that would blow
    // past Date's range if naively treated as milliseconds.
    const millis = TO_MILLIS[detectNumericUnit(trimmed)](Number(trimmed));
    date = new Date(millis);
  } else {
    date = new Date(trimmed);
  }

  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Parse an `<input type="datetime-local">` value (e.g. "2026-07-12T10:30" or
 * "…:30:15") as either local time or UTC. Returns null on a malformed value.
 */
export function parseDateTimeLocal(value: string, zone: 'local' | 'utc'): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const parts = [Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? '0')] as const;
  const date = zone === 'utc' ? new Date(Date.UTC(...parts)) : new Date(...parts);
  return Number.isNaN(date.getTime()) ? null : date;
}
