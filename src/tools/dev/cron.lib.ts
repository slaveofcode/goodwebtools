/**
 * Cron expression parser, human-readable explainer, and next-run calculator.
 * Standard 5-field unix cron: minute hour dom month dow
 * All logic is pure and runs entirely client-side.
 */

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'] as const;
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
  '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th',
  '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th', '29th', '30th', '31st'] as const;

export interface FieldMeta { min: number; max: number; names?: readonly string[] }

export const FIELD_META: Record<'minute' | 'hour' | 'dom' | 'month' | 'dow', FieldMeta> = {
  minute: { min: 0, max: 59 },
  hour:   { min: 0, max: 23 },
  dom:    { min: 1, max: 31 },
  month:  { min: 1, max: 12, names: MONTH_NAMES },
  dow:    { min: 0, max: 7,  names: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
};

export interface ParsedField {
  raw: string;
  /** Resolved set of matching values (dow 7 normalised to 0). */
  values: Set<number>;
  /** True when the field matches every valid value (raw is star or step-1 of full range). */
  isAll: boolean;
  /** Step value when the field is a step expression, else undefined. */
  step?: number;
  /** Range [from, to] when the field is a plain range or range+step. */
  range?: [number, number];
  /** List of literal values when the field is a comma-separated list. */
  list?: number[];
}

export interface ParsedCron {
  minute: ParsedField;
  hour:   ParsedField;
  dom:    ParsedField;
  month:  ParsedField;
  dow:    ParsedField;
}

export type CronParseResult =
  | { ok: true;  cron: ParsedCron }
  | { ok: false; error: string };

// ─── Parsing ────────────────────────────────────────────────────────────────

function resolveRange(from: number, to: number, step: number, min: number, max: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= Math.min(to, max); v += step) if (v >= min) out.push(v);
  return out;
}

export function parseField(raw: string, meta: FieldMeta): ParsedField | string {
  const { min, max } = meta;

  if (raw === '*') {
    const values = new Set<number>();
    for (let v = min; v <= max; v++) values.add(v);
    return { raw, values, isAll: true };
  }

  // Step: */n or base/n
  if (raw.includes('/')) {
    const [basePart, stepPart] = raw.split('/');
    const step = parseInt(stepPart, 10);
    if (isNaN(step) || step < 1) return `Invalid step "${stepPart}" in "${raw}"`;

    let from = min, to = max;
    if (basePart !== '*') {
      if (basePart.includes('-')) {
        const [a, b] = basePart.split('-').map(Number);
        if (isNaN(a) || isNaN(b)) return `Invalid range "${basePart}" in "${raw}"`;
        from = a; to = b;
      } else {
        from = parseInt(basePart, 10);
        if (isNaN(from)) return `Invalid base "${basePart}" in "${raw}"`;
        to = max;
      }
    }
    if (from < min || to > max) return `Value out of range [${min}-${max}] in "${raw}"`;
    const nums = resolveRange(from, to, step, min, max);
    const values = new Set(nums.map(v => (meta === FIELD_META.dow && v === 7) ? 0 : v));
    return { raw, values, isAll: step === 1 && from === min && to === max, step, range: [from, to] };
  }

  // List: a,b,c
  if (raw.includes(',')) {
    const parts = raw.split(',');
    const nums: number[] = [];
    for (const p of parts) {
      const v = parseInt(p, 10);
      if (isNaN(v) || v < min || v > max) return `Value "${p}" out of range [${min}-${max}]`;
      nums.push(v);
    }
    const values = new Set(nums.map(v => (meta === FIELD_META.dow && v === 7) ? 0 : v));
    return { raw, values, isAll: false, list: nums };
  }

  // Range: a-b
  if (raw.includes('-')) {
    const [a, b] = raw.split('-').map(Number);
    if (isNaN(a) || isNaN(b)) return `Invalid range "${raw}"`;
    if (a < min || b > max || a > b) return `Range "${raw}" out of bounds [${min}-${max}]`;
    const nums = resolveRange(a, b, 1, min, max);
    const values = new Set(nums.map(v => (meta === FIELD_META.dow && v === 7) ? 0 : v));
    return { raw, values, isAll: a === min && b === max, range: [a, b] };
  }

  // Single value
  const v = parseInt(raw, 10);
  if (isNaN(v) || v < min || v > max) return `Value "${raw}" out of range [${min}-${max}]`;
  const norm = (meta === FIELD_META.dow && v === 7) ? 0 : v;
  return { raw, values: new Set([norm]), isAll: false };
}

export function parseCron(expr: string): CronParseResult {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { ok: false, error: `Expected 5 fields, got ${parts.length}` };
  const [m, h, dom, month, dow] = parts;
  const fields: [string, 'minute' | 'hour' | 'dom' | 'month' | 'dow'][] = [
    [m, 'minute'], [h, 'hour'], [dom, 'dom'], [month, 'month'], [dow, 'dow'],
  ];
  const parsed: Partial<ParsedCron> = {};
  for (const [raw, name] of fields) {
    const res = parseField(raw, FIELD_META[name]);
    if (typeof res === 'string') return { ok: false, error: `${name}: ${res}` };
    (parsed as Record<string, ParsedField>)[name] = res;
  }
  return { ok: true, cron: parsed as ParsedCron };
}

// ─── Explanation ─────────────────────────────────────────────────────────────

function pad(n: number) { return n.toString().padStart(2, '0'); }

function listNames(values: number[], names: readonly string[]): string {
  const ns = [...values].map(v => names[v]).filter(Boolean);
  if (ns.length === 0) return '';
  if (ns.length === 1) return ns[0];
  if (ns.length === 2) return `${ns[0]} and ${ns[1]}`;
  return ns.slice(0, -1).join(', ') + ', and ' + ns[ns.length - 1];
}

function formatTime(hour: ParsedField, minute: ParsedField): string {
  const h = [...hour.values][0];
  const m = [...minute.values][0];
  return `${pad(h)}:${pad(m)}`;
}

export function explainCron(cron: ParsedCron): string {
  const { minute, hour, dom, month, dow } = cron;

  // ── Fully wildcard ──────────────────────────────────────────────────────
  if (minute.isAll && hour.isAll && dom.isAll && month.isAll && dow.isAll) {
    return 'Every minute';
  }

  // ── Time clause ─────────────────────────────────────────────────────────
  let timeClause = '';

  if (minute.isAll && hour.isAll) {
    timeClause = 'every minute';
  } else if (!minute.isAll && hour.isAll) {
    // e.g. */15 * or 30 *
    if (minute.step !== undefined && minute.values.size > 1) {
      timeClause = `every ${minute.step} minute${minute.step === 1 ? '' : 's'}`;
    } else if (minute.list) {
      const ms = minute.list.map(String).join(', ');
      timeClause = `at minute${minute.list.length > 1 ? 's' : ''} ${ms} past every hour`;
    } else if (minute.range && minute.values.size > 1) {
      timeClause = `at every minute from :${pad(minute.range[0])} to :${pad(minute.range[1])}`;
    } else {
      const m = [...minute.values][0];
      timeClause = m === 0 ? 'at the top of every hour' : `at minute ${m} of every hour`;
    }
  } else if (minute.values.size === 1 && hour.values.size === 1) {
    // Single time
    timeClause = `at ${formatTime(hour, minute)}`;
  } else if (minute.values.size === 1 && hour.step !== undefined) {
    const m = [...minute.values][0];
    timeClause = `every ${hour.step} hour${hour.step === 1 ? '' : 's'}` +
      (m === 0 ? '' : ` at minute ${m}`);
  } else if (minute.values.size === 1 && hour.list) {
    const m = [...minute.values][0];
    const hs = hour.list.map(h => `${pad(h)}:${pad(m)}`).join(', ');
    timeClause = `at ${hs}`;
  } else if (minute.values.size === 1 && hour.range) {
    const m = [...minute.values][0];
    timeClause = `at minute ${m} of every hour from ${pad(hour.range[0])} to ${pad(hour.range[1])}`;
  } else if (minute.step !== undefined) {
    // */15 with specific hours
    const hs = [...hour.values].map(h => pad(h)).join(', ');
    timeClause = `every ${minute.step} minutes during hour${hour.values.size > 1 ? 's' : ''} ${hs}`;
  } else {
    // Fallback for complex combinations
    const ms = [...minute.values].map(String).join(', ');
    const hs = [...hour.values].map(String).join(', ');
    timeClause = `at minute${minute.values.size > 1 ? 's' : ''} ${ms} of hour${hour.values.size > 1 ? 's' : ''} ${hs}`;
  }

  // ── Day clause ──────────────────────────────────────────────────────────
  const parts: string[] = [timeClause];

  const hasDow = !dow.isAll;
  const hasDom = !dom.isAll;

  if (hasDow && hasDom) {
    // Standard unix: DOM OR DOW when both restricted
    const domPart = buildDomClause(dom);
    const dowPart = buildDowClause(dow);
    parts.push(`if it's ${dowPart} or the ${domPart}`);
  } else if (hasDow) {
    parts.push(buildDowClause(dow));
  } else if (hasDom) {
    parts.push(buildDomClause(dom));
  }

  if (!month.isAll) {
    if (month.values.size === 1) {
      parts.push(`in ${MONTH_NAMES[[...month.values][0]]}`);
    } else if (month.range && !month.list) {
      parts.push(`from ${MONTH_NAMES[month.range[0]]} through ${MONTH_NAMES[month.range[1]]}`);
    } else {
      parts.push(`in ${listNames([...month.values], MONTH_NAMES)}`);
    }
  }

  if (!hasDow && !hasDom && month.isAll) {
    // No day restriction — add "every day" only when time is not already "every minute"
    if (!minute.isAll || !hour.isAll) {
      // time clause already implies daily repetition; don't add redundant suffix
    }
  }

  return capitalize(parts.join(', '));
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function buildDomClause(dom: ParsedField): string {
  if (dom.list) {
    const ords = dom.list.map(d => ORDINAL[d]).join(' and ');
    return `on the ${ords} of every month`;
  }
  if (dom.range) {
    return `on days ${dom.range[0]}–${dom.range[1]} of every month`;
  }
  const d = [...dom.values][0];
  return `on the ${ORDINAL[d]} of every month`;
}

function buildDowClause(dow: ParsedField): string {
  if (dow.values.size === 7) return 'every day';

  // Detect weekdays / weekends
  const vals = [...dow.values].sort((a, b) => a - b);
  const weekdays = [1, 2, 3, 4, 5];
  const weekends = [0, 6];
  if (weekdays.every(d => vals.includes(d)) && vals.length === 5) return 'on weekdays';
  if (weekends.every(d => vals.includes(d)) && vals.length === 2) return 'on weekends';

  if (dow.range) {
    return `on every day from ${DOW_NAMES[dow.range[0]]} through ${DOW_NAMES[Math.min(dow.range[1], 6)]}`;
  }
  if (dow.list || vals.length > 1) {
    return `on ${listNames(vals, DOW_NAMES)}`;
  }
  return `on ${DOW_NAMES[vals[0]]}`;
}

// ─── Matching & next runs ────────────────────────────────────────────────────

export function matchesCron(cron: ParsedCron, date: Date): boolean {
  const min = date.getMinutes();
  const hour = date.getHours();
  const dom = date.getDate();
  const month = date.getMonth() + 1;
  const dow = date.getDay();

  if (!cron.minute.values.has(min)) return false;
  if (!cron.hour.values.has(hour)) return false;
  if (!cron.month.values.has(month)) return false;

  // Unix cron: if both dom and dow are restricted, either can match (OR logic).
  // If only one is restricted, that one must match.
  const domRestricted = !cron.dom.isAll;
  const dowRestricted = !cron.dow.isAll;
  if (domRestricted && dowRestricted) {
    if (!cron.dom.values.has(dom) && !cron.dow.values.has(dow)) return false;
  } else if (domRestricted) {
    if (!cron.dom.values.has(dom)) return false;
  } else if (dowRestricted) {
    if (!cron.dow.values.has(dow)) return false;
  }

  return true;
}

export function nextRuns(cron: ParsedCron, from: Date, n: number): Date[] {
  const results: Date[] = [];
  // Round up to the next minute boundary.
  const start = new Date(from);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  const limit = new Date(start);
  limit.setFullYear(limit.getFullYear() + 4); // search up to 4 years out

  const cur = new Date(start);
  while (cur < limit && results.length < n) {
    if (matchesCron(cron, cur)) results.push(new Date(cur));
    cur.setMinutes(cur.getMinutes() + 1);
  }
  return results;
}

// ─── Field labels ────────────────────────────────────────────────────────────

export const FIELD_LABELS = [
  { key: 'minute', label: 'Minute',       hint: '0–59' },
  { key: 'hour',   label: 'Hour',         hint: '0–23' },
  { key: 'dom',    label: 'Day (month)',   hint: '1–31' },
  { key: 'month',  label: 'Month',        hint: '1–12' },
  { key: 'dow',    label: 'Weekday',      hint: '0–7 (Sun=0,7)' },
] as const;

// ─── Presets ─────────────────────────────────────────────────────────────────

export const CRON_PRESETS: { label: string; expr: string }[] = [
  { label: 'Every minute',    expr: '* * * * *' },
  { label: 'Every 5 min',    expr: '*/5 * * * *' },
  { label: 'Every 15 min',   expr: '*/15 * * * *' },
  { label: 'Every 30 min',   expr: '*/30 * * * *' },
  { label: 'Every hour',     expr: '0 * * * *' },
  { label: 'Every 6 hours',  expr: '0 */6 * * *' },
  { label: 'Midnight daily', expr: '0 0 * * *' },
  { label: 'Noon daily',     expr: '0 12 * * *' },
  { label: 'Every weekday',  expr: '0 9 * * 1-5' },
  { label: 'Every weekend',  expr: '0 10 * * 0,6' },
  { label: 'Weekly (Mon)',   expr: '0 0 * * 1' },
  { label: 'Monthly (1st)',  expr: '0 0 1 * *' },
  { label: 'Yearly (Jan 1)', expr: '0 0 1 1 *' },
];
