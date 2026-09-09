/**
 * Pure helpers for the calendar / date-time picker used by the Countdown tool.
 * Framework-free and deterministic — the "current time" is always passed in so
 * the presets are testable. The picker's value uses the same
 * `YYYY-MM-DDTHH:mm` local string shape as a native `datetime-local` input, so
 * it stays a drop-in replacement.
 */

export interface DayCell {
  /** Local date at midnight for this grid cell. */
  date: Date;
  /** True when the cell belongs to the month being displayed (not a spill-over). */
  inMonth: boolean;
}

export type PresetKind = 'tomorrow' | 'nextWeek' | 'newYear';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Parse a `YYYY-MM-DDTHH:mm` local value into a Date. Returns null if empty/invalid. */
export function parseLocalValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  // Reject roll-overs (e.g. Feb 31 → Mar 3).
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Serialise a Date to the `YYYY-MM-DDTHH:mm` local value shape. */
export function toLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** True when two Dates fall on the same local calendar day. */
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Add `n` days, preserving the time of day. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

/**
 * A 6×7 (42-cell) grid for the given month, Sunday-first, including the
 * spill-over days from the neighbouring months so every week row is full.
 * `month` is 0-based (0 = January).
 */
export function buildMonthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(year, month, 1 - startOffset + i);
    cells.push({ date, inMonth: date.getMonth() === month && date.getFullYear() === year });
  }
  return cells;
}

/** Convert a 24-hour hour into a 12-hour clock value + AM/PM. */
export function to12h(hour24: number): { hour12: number; ampm: 'AM' | 'PM' } {
  const ampm = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, ampm };
}

/** Convert a 12-hour clock value + AM/PM back into a 24-hour hour. */
export function from12h(hour12: number, ampm: 'AM' | 'PM'): number {
  const h = hour12 % 12; // 12 → 0
  return ampm === 'PM' ? h + 12 : h;
}

/** The Date a quick-preset button resolves to, relative to `from` (now). */
export function presetDate(kind: PresetKind, from: Date): Date {
  switch (kind) {
    case 'tomorrow': {
      const d = addDays(from, 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    case 'nextWeek': {
      const d = addDays(from, 7);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    case 'newYear':
      return new Date(from.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
  }
}
