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

export function parseTimestamp(input: string): Date | null {
  const trimmed = input.trim();
  let date: Date;
  if (/^\d+$/.test(trimmed)) {
    // Numeric: treat 10-digit as seconds, 13-digit as milliseconds.
    const num = Number(trimmed);
    date = new Date(trimmed.length <= 10 ? num * 1000 : num);
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
