/**
 * Pure helpers for the live Digital Clock. Framework- and timer-free so they
 * are deterministic to unit-test — the island supplies the ticking `epochMs`
 * (a high-resolution float) via requestAnimationFrame.
 *
 * Note on precision: browsers only expose millisecond-resolution wall-clock
 * time (`Date.now()`); `performance.now()` is deliberately clamped (~5–100µs,
 * sometimes 1ms) as a Spectre mitigation. The microsecond field is therefore a
 * best-effort reading of the high-resolution timer, not a true hardware clock.
 */

export interface ClockReadout {
  hh: string;
  mm: string;
  ss: string;
  /** '000'–'999' — whole milliseconds within the current second. */
  millis: string;
  /** '000'–'999' — microseconds within the current millisecond (best-effort). */
  micros: string;
  /** Localized AM/PM when in 12-hour mode, otherwise ''. */
  dayPeriod: string;
  /** Localized date line, e.g. 'Tue, 9 Sep 2026'. */
  dateLabel: string;
  /** e.g. 'UTC+7', 'UTC+05:30', 'UTC'. */
  offsetLabel: string;
  epochSec: number;
  epochMs: number;
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** The IANA time zone the browser is running in (falls back to 'UTC'). */
export function detectTimeZone(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Every IANA time zone the runtime knows, or a small fallback list. */
export function listTimeZones(): string[] {
  const anyIntl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof anyIntl.supportedValuesOf === 'function') {
    try {
      const zones = anyIntl.supportedValuesOf('timeZone');
      // Some engines omit bare 'UTC' from the IANA list — always offer it.
      return zones.includes('UTC') ? zones : ['UTC', ...zones];
    } catch {
      /* fall through */
    }
  }
  return ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Jakarta', 'Asia/Tokyo', 'Australia/Sydney'];
}

/** 'UTC+7' / 'UTC+05:30' / 'UTC' for the given instant + zone. */
export function zoneOffsetLabel(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(date);
    const tz = (parts.find(p => p.type === 'timeZoneName')?.value ?? 'UTC').replace('GMT', 'UTC');
    // Canonicalise the engine-dependent offset ('UTC+5:30' vs 'UTC+05:30') to
    // 'UTC±H' for whole hours and 'UTC±HH:MM' when there are minutes.
    const m = /^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(tz);
    if (!m) return tz; // already 'UTC'
    const [, sign, h, min] = m;
    if ((h === '0' || h === '00') && (!min || min === '00')) return 'UTC';
    return min && min !== '00'
      ? `UTC${sign}${h.padStart(2, '0')}:${min}`
      : `UTC${sign}${String(Number(h))}`;
  } catch {
    return 'UTC';
  }
}

/**
 * Build a full readout for a high-resolution epoch time (ms, may be
 * fractional) in the given zone. `locale` drives the date/AM-PM wording.
 */
export function clockReadout(epochMs: number, timeZone: string, hour12: boolean, locale = 'en-US'): ClockReadout {
  const whole = Math.floor(epochMs);
  const date = new Date(whole);

  let hh = '00', mm = '00', ss = '00', dayPeriod = '';
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour12,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    for (const p of parts) {
      if (p.type === 'hour') hh = p.value.padStart(2, '0');
      else if (p.type === 'minute') mm = p.value.padStart(2, '0');
      else if (p.type === 'second') ss = p.value.padStart(2, '0');
      else if (p.type === 'dayPeriod') dayPeriod = p.value;
    }
  } catch {
    /* leave zeros on a bad zone */
  }

  let dateLabel = '';
  try {
    dateLabel = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    /* ignore */
  }

  const subSecond = ((epochMs % 1000) + 1000) % 1000; // 0–1000 float
  const millis = Math.floor(subSecond);
  const micros = Math.floor((subSecond - millis) * 1000);

  return {
    hh,
    mm,
    ss,
    millis: pad(millis, 3),
    micros: pad(micros, 3),
    dayPeriod: hour12 ? dayPeriod : '',
    dateLabel,
    offsetLabel: zoneOffsetLabel(date, timeZone),
    epochSec: Math.floor(whole / 1000),
    epochMs: whole,
  };
}
