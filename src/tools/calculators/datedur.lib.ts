/**
 * Pure date-difference math. All functions take/return `YYYY-MM-DD` strings and
 * work in UTC internally, so results never shift with the local timezone.
 */

const DAY = 86_400_000;

/** Parse `YYYY-MM-DD` to a UTC epoch (ms), or NaN if malformed. */
function parseUtc(iso: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.parse(iso + 'T00:00:00Z') : NaN;
}

/** Whole days from `a` to `b` (negative if b is before a). */
export function daysBetween(a: string, b: string): number {
  const da = parseUtc(a), db = parseUtc(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return NaN;
  return Math.round((db - da) / DAY);
}

function daysInMonth(year: number, monthIndex0: number): number {
  // monthIndex0 may be -1 (Dec of prev year) or 12 (Jan of next) — Date normalizes it.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * Calendar breakdown (years/months/days) of the span between two dates. Order of
 * the arguments doesn't matter; the magnitude is returned.
 */
export function ymdBetween(a: string, b: string): { years: number; months: number; days: number } {
  let da = parseUtc(a), db = parseUtc(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return { years: NaN, months: NaN, days: NaN };
  if (da > db) [da, db] = [db, da];
  const s = new Date(da), e = new Date(db);

  let years = e.getUTCFullYear() - s.getUTCFullYear();
  let months = e.getUTCMonth() - s.getUTCMonth();
  let days = e.getUTCDate() - s.getUTCDate();

  if (days < 0) {
    months -= 1;
    // Borrow the length of the month before the end month.
    days += daysInMonth(e.getUTCFullYear(), e.getUTCMonth() - 1);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

/** Add (or subtract, with a negative n) whole days to a date. */
export function addDays(iso: string, n: number): string {
  const t = parseUtc(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t + n * DAY).toISOString().slice(0, 10);
}

/** Count of weekdays (Mon–Fri) between two dates, inclusive of both endpoints. */
export function businessDaysBetween(a: string, b: string): number {
  let da = parseUtc(a), db = parseUtc(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return NaN;
  if (da > db) [da, db] = [db, da];
  let count = 0;
  for (let t = da; t <= db; t += DAY) {
    const dow = new Date(t).getUTCDay(); // 0 Sun … 6 Sat
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}
