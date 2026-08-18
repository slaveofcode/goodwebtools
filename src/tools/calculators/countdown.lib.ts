/**
 * Countdown / "days until a date" maths. Pure and framework-free — every
 * function takes the reference time explicitly so it is deterministic to test;
 * the island passes Date.now().
 */

export interface Breakdown {
  past: boolean;
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Break the gap between `fromMs` and `toMs` into d/h/m/s. */
export function breakdown(fromMs: number, toMs: number): Breakdown {
  const diff = toMs - fromMs;
  const past = diff < 0;
  let s = Math.floor(Math.abs(diff) / 1000);
  const days = Math.floor(s / 86400); s -= days * 86400;
  const hours = Math.floor(s / 3600); s -= hours * 3600;
  const minutes = Math.floor(s / 60); s -= minutes * 60;
  return { past, totalSeconds: Math.floor(Math.abs(diff) / 1000), days, hours, minutes, seconds: s };
}

/**
 * Whole calendar days from one date to another, ignoring the time of day.
 * Positive = target is in the future. Uses UTC midnights to avoid DST drift.
 */
export function daysUntil(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

/** Count of a given weekday-agnostic set — number of weekdays (Mon–Fri) in [from, to]. */
export function businessDaysUntil(from: Date, to: Date): number {
  const total = daysUntil(from, to);
  if (total === 0) return 0;
  const step = total > 0 ? 1 : -1;
  let count = 0;
  const cursor = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  for (let i = 0; i !== total; i += step) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) count += step;
  }
  return count;
}
