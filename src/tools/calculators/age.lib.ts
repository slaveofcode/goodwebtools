/**
 * Pure calendar-age math. All calculations use UTC to stay free of timezone and
 * DST drift — a birth date is a calendar date, not an instant.
 */

export interface AgeParts { years: number; months: number; days: number; }
export interface AgeTotals { days: number; weeks: number; months: number; hours: number; }
export interface NextBirthday { inDays: number; turning: number; weekday: number; }

const DAY_MS = 86_400_000;

/** Parse a strict `YYYY-MM-DD` string to a UTC-midnight Date, or null if invalid. */
export function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Reject rollovers like 2000-02-30 → Mar 1.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Whole years/months/days between two dates (asOf ≥ birth). */
export function ageParts(birth: Date, asOf: Date): AgeParts {
  let years = asOf.getUTCFullYear() - birth.getUTCFullYear();
  let months = asOf.getUTCMonth() - birth.getUTCMonth();
  let days = asOf.getUTCDate() - birth.getUTCDate();
  if (days < 0) {
    months -= 1;
    // Days in the month immediately before asOf's month (day 0 = last day of prev month).
    const prevMonthDays = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 0)).getUTCDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

/** Total elapsed units between two dates. */
export function ageTotals(birth: Date, asOf: Date): AgeTotals {
  const ms = asOf.getTime() - birth.getTime();
  const days = Math.floor(ms / DAY_MS);
  const { years, months } = ageParts(birth, asOf);
  return {
    days,
    weeks: Math.floor(days / 7),
    months: years * 12 + months,
    hours: Math.floor(ms / 3_600_000),
  };
}

/** The next birthday on or after asOf: days away, the age being turned, and the birth weekday. */
export function nextBirthday(birth: Date, asOf: Date): NextBirthday {
  const bm = birth.getUTCMonth();
  const bd = birth.getUTCDate();
  let year = asOf.getUTCFullYear();
  let next = new Date(Date.UTC(year, bm, bd));
  if (next.getTime() < asOf.getTime()) {
    year += 1;
    next = new Date(Date.UTC(year, bm, bd));
  }
  const inDays = Math.round((next.getTime() - asOf.getTime()) / DAY_MS);
  return { inDays, turning: year - birth.getUTCFullYear(), weekday: birth.getUTCDay() };
}
