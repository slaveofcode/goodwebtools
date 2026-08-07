/**
 * Reverse cron: convert a plain-English schedule description to a 5-field
 * cron expression. Pure rule-based NLP — no AI, no server, runs client-side.
 *
 * Handles the most common scheduling patterns:
 *   "every 15 minutes", "every weekday at 9am", "midnight on the 1st", etc.
 */

// ─── Lookup tables ───────────────────────────────────────────────────────────

const DOW_MAP: Record<string, number> = {
  sun: 0, sunday: 0, sundays: 0,
  mon: 1, monday: 1, mondays: 1,
  tue: 2, tues: 2, tuesday: 2, tuesdays: 2,
  wed: 3, weds: 3, wednesday: 3, wednesdays: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, thursdays: 4,
  fri: 5, friday: 5, fridays: 5,
  sat: 6, saturday: 6, saturdays: 6,
};

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

// Ordinal word/suffix → day-of-month number
const ORDINAL_MAP: Record<string, number> = {
  '1st': 1, first: 1,
  '2nd': 2, second: 2,
  '3rd': 3, third: 3,
  '4th': 4, fourth: 4,
  '5th': 5, fifth: 5,
  '6th': 6, sixth: 6,
  '7th': 7, seventh: 7,
  '8th': 8, eighth: 8,
  '9th': 9, ninth: 9,
  '10th': 10, tenth: 10,
  '11th': 11, eleventh: 11,
  '12th': 12, twelfth: 12,
  '13th': 13, thirteenth: 13,
  '14th': 14, fourteenth: 14,
  '15th': 15, fifteenth: 15,
  '16th': 16, sixteenth: 16,
  '17th': 17, seventeenth: 17,
  '18th': 18, eighteenth: 18,
  '19th': 19, nineteenth: 19,
  '20th': 20, twentieth: 20,
  '21st': 21, 'twenty-first': 21,
  '22nd': 22, 'twenty-second': 22,
  '23rd': 23, 'twenty-third': 23,
  '24th': 24, 'twenty-fourth': 24,
  '25th': 25, 'twenty-fifth': 25,
  '26th': 26, 'twenty-sixth': 26,
  '27th': 27, 'twenty-seventh': 27,
  '28th': 28, 'twenty-eighth': 28,
  '29th': 29, 'twenty-ninth': 29,
  '30th': 30, thirtieth: 30,
  '31st': 31, 'thirty-first': 31,
};

// ─── Public API ───────────────────────────────────────────────────────────────

export type NaturalParseResult =
  | { ok: true;  expr: string }
  | { ok: false; error: string };

/**
 * Convert a plain-English schedule description to a cron expression.
 * Returns ok:false when the description doesn't match any known pattern.
 */
export function naturalToCron(input: string): NaturalParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Empty input' };

  const text = raw.toLowerCase()
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ── 1. Pure-interval shortcuts ──────────────────────────────────────────

  if (/\bevery\s+minute\b/.test(text)) return { ok: true, expr: '* * * * *' };

  const minuteStep = text.match(/\bevery\s+(\d+)\s+min(?:ute)?s?\b/);
  if (minuteStep) {
    const n = parseInt(minuteStep[1]);
    if (n < 2 || n > 59) return { ok: false, error: `Minute interval must be 2–59 (got ${n})` };
    return { ok: true, expr: `*/${n} * * * *` };
  }

  if (/\b(?:every\s+hour|hourly)\b/.test(text)) return { ok: true, expr: '0 * * * *' };

  const hourStep = text.match(/\bevery\s+(\d+)\s+hours?\b/);
  if (hourStep) {
    const n = parseInt(hourStep[1]);
    if (n < 2 || n > 23) return { ok: false, error: `Hour interval must be 2–23 (got ${n})` };
    return { ok: true, expr: `0 */${n} * * *` };
  }

  // ── 2. Extract components ───────────────────────────────────────────────

  const time = extractTime(text);
  const dows = extractDow(text);
  const dom  = extractDom(text);
  const month = extractMonth(text);

  const minutePart = time ? String(time.minute) : '0';
  const hourPart   = time ? String(time.hour)   : null;

  // ── 3. "yearly" / "annually" ────────────────────────────────────────────

  if (/\b(?:yearly|annually|every\s+year)\b/.test(text)) {
    const h = hourPart ?? '0';
    const d = dom   ?? 1;
    const mo = month ?? 1;
    return { ok: true, expr: `${minutePart} ${h} ${d} ${mo} *` };
  }

  // ── 4. "monthly" / "every month" ────────────────────────────────────────

  if (/\b(?:monthly|every\s+month)\b/.test(text) && !dows) {
    const h = hourPart ?? '0';
    const d = dom ?? 1;
    const mo = month ? String(month) : '*';
    return { ok: true, expr: `${minutePart} ${h} ${d} ${mo} *` };
  }

  // ── 5. Specific month → implies yearly ──────────────────────────────────

  if (month && !dows) {
    const h = hourPart ?? '0';
    const d = dom ?? 1;
    return { ok: true, expr: `${minutePart} ${h} ${d} ${month} *` };
  }

  // ── 6. "weekly" / "every week" ──────────────────────────────────────────

  if (/\b(?:weekly|every\s+week)\b/.test(text) && !dows) {
    const h = hourPart ?? '0';
    return { ok: true, expr: `${minutePart} ${h} * * 0` };
  }

  // ── 7. Day-of-month specified ────────────────────────────────────────────

  if (dom && !dows) {
    const h = hourPart ?? '0';
    const mo = month ? String(month) : '*';
    return { ok: true, expr: `${minutePart} ${h} ${dom} ${mo} *` };
  }

  // ── 8. Day-of-week specified ─────────────────────────────────────────────

  if (dows) {
    if (hourPart === null) {
      // "every Monday" without a time → midnight
      return { ok: true, expr: `0 0 * * ${dows}` };
    }
    return { ok: true, expr: `${minutePart} ${hourPart} * * ${dows}` };
  }

  // ── 9. "daily" / "every day" ────────────────────────────────────────────

  if (/\b(?:daily|every\s+day)\b/.test(text)) {
    const h = hourPart ?? '0';
    return { ok: true, expr: `${minutePart} ${h} * * *` };
  }

  // ── 10. Time with no day restriction ────────────────────────────────────

  if (time) {
    return { ok: true, expr: `${minutePart} ${hourPart ?? '0'} * * *` };
  }

  return { ok: false, error: 'Could not parse — try "every 15 minutes", "weekdays at 9am", "1st of every month"' };
}

// ─── Component extractors ────────────────────────────────────────────────────

interface ParsedTime { hour: number; minute: number }

export function extractTime(text: string): ParsedTime | null {
  // "midnight"
  if (/\bmidnight\b/.test(text)) return { hour: 0, minute: 0 };
  // "noon" / "midday"
  if (/\b(?:noon|midday)\b/.test(text)) return { hour: 12, minute: 0 };

  // "HH:MM am/pm" or "HH:MM"
  const hhmm = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
  if (hhmm) {
    let h = parseInt(hhmm[1]);
    const m = parseInt(hhmm[2]);
    if (hhmm[3] === 'pm' && h < 12) h += 12;
    if (hhmm[3] === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { hour: h, minute: m };
  }

  // "N am" / "N pm" (possibly preceded by "at")
  const ampm = text.match(/\b(?:at\s+)?(\d{1,2})\s*(am|pm)\b/);
  if (ampm) {
    let h = parseInt(ampm[1]);
    if (ampm[2] === 'pm' && h < 12) h += 12;
    if (ampm[2] === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23) return { hour: h, minute: 0 };
  }

  // "at N" (bare number 0–23)
  const atN = text.match(/\bat\s+(\d{1,2})\b/);
  if (atN) {
    const h = parseInt(atN[1]);
    if (h >= 0 && h <= 23) return { hour: h, minute: 0 };
  }

  return null;
}

/** Returns a cron DOW field string or null if no weekday constraint found. */
export function extractDow(text: string): string | null {
  // "weekday(s)" / "monday through friday" / "mon-fri"
  if (/\bweekdays?\b/.test(text) || /\bmon(?:day)?\s+(?:through|to|-)\s+fri(?:day)?\b/.test(text)) {
    return '1-5';
  }
  // "weekend(s)" / "saturday and sunday"
  if (/\bweekends?\b/.test(text) || /\b(?:sat(?:urday)?\s+and\s+sun(?:day)?|sun(?:day)?\s+and\s+sat(?:urday)?)\b/.test(text)) {
    return '0,6';
  }

  // Scan for day name tokens (handles lists: "monday wednesday friday" or "monday and wednesday")
  const tokens = text.replace(/\band\b/g, ' ').split(/\s+/);
  const days: number[] = [];
  for (const tok of tokens) {
    if (tok in DOW_MAP) days.push(DOW_MAP[tok]);
  }
  if (days.length === 0) return null;
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.length === 7) return '*';
  return unique.join(',');
}

/** Returns a day-of-month number or null. */
export function extractDom(text: string): number | null {
  // "on the Nth" / "day N" / "Nth of the month"
  for (const [word, n] of Object.entries(ORDINAL_MAP)) {
    const re = new RegExp(`\\b${word}\\b`);
    if (re.test(text)) return n;
  }
  // bare number after "day" — e.g. "day 15"
  const dayN = text.match(/\bday\s+(\d{1,2})\b/);
  if (dayN) {
    const n = parseInt(dayN[1]);
    if (n >= 1 && n <= 31) return n;
  }
  return null;
}

/** Returns a month number (1–12) or null. */
export function extractMonth(text: string): number | null {
  for (const [word, n] of Object.entries(MONTH_MAP)) {
    const re = new RegExp(`\\b${word}\\b`);
    if (re.test(text)) return n;
  }
  return null;
}

// ─── Example hints ────────────────────────────────────────────────────────────

export const NATURAL_EXAMPLES = [
  'every minute',
  'every 15 minutes',
  'every hour',
  'every 6 hours',
  'daily at midnight',
  'every day at 9am',
  'every weekday at 9:30am',
  'every Monday at noon',
  'every Monday and Wednesday at 8am',
  'every weekend at 10am',
  'monthly on the 1st',
  'every year on January 1st',
];
