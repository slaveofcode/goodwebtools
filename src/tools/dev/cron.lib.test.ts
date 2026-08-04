import { describe, it, expect } from 'vitest';
import {
  parseField, parseCron, explainCron, matchesCron, nextRuns,
  FIELD_META, type ParsedCron,
} from './cron.lib';

// ─── parseField ──────────────────────────────────────────────────────────────

describe('parseField', () => {
  it('* resolves to all values in range', () => {
    const f = parseField('*', FIELD_META.minute);
    if (typeof f === 'string') throw f;
    expect(f.isAll).toBe(true);
    expect(f.values.has(0)).toBe(true);
    expect(f.values.has(59)).toBe(true);
    expect(f.values.size).toBe(60);
  });

  it('single value', () => {
    const f = parseField('30', FIELD_META.minute);
    if (typeof f === 'string') throw f;
    expect(f.values).toEqual(new Set([30]));
    expect(f.isAll).toBe(false);
  });

  it('range a-b', () => {
    const f = parseField('1-5', FIELD_META.dow);
    if (typeof f === 'string') throw f;
    expect([...f.values].sort((a,b)=>a-b)).toEqual([1,2,3,4,5]);
    expect(f.range).toEqual([1, 5]);
  });

  it('step */n', () => {
    const f = parseField('*/15', FIELD_META.minute);
    if (typeof f === 'string') throw f;
    expect([...f.values].sort((a,b)=>a-b)).toEqual([0,15,30,45]);
    expect(f.step).toBe(15);
  });

  it('range with step a-b/n', () => {
    const f = parseField('1-6/2', FIELD_META.month);
    if (typeof f === 'string') throw f;
    expect([...f.values].sort((a,b)=>a-b)).toEqual([1,3,5]);
  });

  it('list a,b,c', () => {
    const f = parseField('0,6', FIELD_META.dow);
    if (typeof f === 'string') throw f;
    expect(f.values.has(0)).toBe(true);
    expect(f.values.has(6)).toBe(true);
    expect(f.list).toEqual([0, 6]);
  });

  it('dow 7 is normalised to 0 (Sunday)', () => {
    const f = parseField('7', FIELD_META.dow);
    if (typeof f === 'string') throw f;
    expect(f.values.has(0)).toBe(true);
    expect(f.values.has(7)).toBe(false);
  });

  it('returns error string for out-of-range', () => {
    expect(typeof parseField('60', FIELD_META.minute)).toBe('string');
    expect(typeof parseField('24', FIELD_META.hour)).toBe('string');
    expect(typeof parseField('0', FIELD_META.dom)).toBe('string');
    expect(typeof parseField('13', FIELD_META.month)).toBe('string');
  });

  it('returns error for invalid step', () => {
    expect(typeof parseField('*/0', FIELD_META.minute)).toBe('string');
    expect(typeof parseField('*/abc', FIELD_META.minute)).toBe('string');
  });
});

// ─── parseCron ───────────────────────────────────────────────────────────────

describe('parseCron', () => {
  it('parses a clean 5-field expression', () => {
    const r = parseCron('0 9 * * 1-5');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cron.minute.values.has(0)).toBe(true);
    expect(r.cron.hour.values.has(9)).toBe(true);
    expect(r.cron.dom.isAll).toBe(true);
    expect(r.cron.dow.values.has(1)).toBe(true);
    expect(r.cron.dow.values.has(5)).toBe(true);
  });

  it('rejects fewer than 5 fields', () => {
    const r = parseCron('* * *');
    expect(r.ok).toBe(false);
  });

  it('rejects more than 5 fields', () => {
    const r = parseCron('* * * * * *');
    expect(r.ok).toBe(false);
  });

  it('propagates per-field errors with field name', () => {
    const r = parseCron('60 * * * *');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/minute/);
  });
});

// ─── explainCron ─────────────────────────────────────────────────────────────

function explain(expr: string): string {
  const r = parseCron(expr);
  if (!r.ok) throw new Error(r.error);
  return explainCron(r.cron);
}

describe('explainCron', () => {
  it.each([
    ['* * * * *',    'Every minute'],
    ['0 * * * *',    'At the top of every hour'],
    ['30 * * * *',   'At minute 30 of every hour'],
    ['0 0 * * *',    'At 00:00'],
    ['0 9 * * *',    'At 09:00'],
    ['0 12 * * *',   'At 12:00'],
    ['*/15 * * * *', 'Every 15 minutes'],
    ['*/30 * * * *', 'Every 30 minutes'],
    ['0 */6 * * *',  'Every 6 hours'],
    ['0 */2 * * *',  'Every 2 hours'],
    ['0 9 * * 1-5',  'At 09:00, on weekdays'],
    ['0 10 * * 0,6', 'At 10:00, on weekends'],
    ['0 9 * * 1',    'At 09:00, on Monday'],
    ['0 9 * * 0',    'At 09:00, on Sunday'],
    ['0 0 1 * *',    'At 00:00, on the 1st of every month'],
    ['0 0 1,15 * *', 'At 00:00, on the 1st and 15th of every month'],
    ['0 0 1 1 *',    'At 00:00, on the 1st of every month, in January'],
    ['0 0 * * 0',    'At 00:00, on Sunday'],
  ])('%s → %s', (expr, expected) => {
    expect(explain(expr)).toBe(expected);
  });
});

// ─── matchesCron ─────────────────────────────────────────────────────────────

describe('matchesCron', () => {
  function parsed(expr: string): ParsedCron {
    const r = parseCron(expr);
    if (!r.ok) throw new Error(r.error);
    return r.cron;
  }
  function date(y: number, mo: number, d: number, h: number, m: number) {
    return new Date(y, mo - 1, d, h, m, 0, 0);
  }

  it('* * * * * matches any time', () => {
    expect(matchesCron(parsed('* * * * *'), date(2024, 3, 15, 9, 30))).toBe(true);
  });

  it('0 9 * * 1-5 matches weekday 09:00', () => {
    const c = parsed('0 9 * * 1-5');
    expect(matchesCron(c, date(2024, 3, 18, 9, 0))).toBe(true);  // Monday
    expect(matchesCron(c, date(2024, 3, 17, 9, 0))).toBe(false); // Sunday
    expect(matchesCron(c, date(2024, 3, 18, 9, 1))).toBe(false); // wrong minute
  });

  it('0 0 1 * * matches 1st of month midnight', () => {
    const c = parsed('0 0 1 * *');
    expect(matchesCron(c, date(2024, 6, 1, 0, 0))).toBe(true);
    expect(matchesCron(c, date(2024, 6, 2, 0, 0))).toBe(false);
  });

  it('dom+dow both restricted: OR logic', () => {
    // 0 0 1 * 1 → midnight on the 1st OR on Monday
    const c = parsed('0 0 1 * 1');
    expect(matchesCron(c, date(2024, 3, 1, 0, 0))).toBe(true);  // 1st of March
    expect(matchesCron(c, date(2024, 3, 4, 0, 0))).toBe(true);  // Monday March 4
    expect(matchesCron(c, date(2024, 3, 5, 0, 0))).toBe(false); // Tuesday not 1st
  });
});

// ─── nextRuns ────────────────────────────────────────────────────────────────

describe('nextRuns', () => {
  it('returns the next N runs', () => {
    const r = parseCron('0 9 * * *');
    if (!r.ok) throw r.error;
    const from = new Date(2024, 2, 18, 8, 0); // March 18 2024 08:00
    const runs = nextRuns(r.cron, from, 3);
    expect(runs).toHaveLength(3);
    expect(runs[0].getHours()).toBe(9);
    expect(runs[0].getMinutes()).toBe(0);
    expect(runs[0].getDate()).toBe(18);
    expect(runs[1].getDate()).toBe(19);
    expect(runs[2].getDate()).toBe(20);
  });

  it('*/15 produces runs 15 minutes apart', () => {
    const r = parseCron('*/15 * * * *');
    if (!r.ok) throw r.error;
    const from = new Date(2024, 0, 1, 0, 0);
    const runs = nextRuns(r.cron, from, 4);
    expect(runs.map(d => d.getMinutes())).toEqual([15, 30, 45, 0]);
  });

  it('returns fewer than n when expression is rare', () => {
    // 0 0 29 2 * — Feb 29 midnight (leap day), very rare
    const r = parseCron('0 0 29 2 *');
    if (!r.ok) throw r.error;
    const from = new Date(2024, 0, 1);
    const runs = nextRuns(r.cron, from, 5);
    // 2024 is a leap year, 2028 is next → at most 2 within 4 years
    expect(runs.length).toBeGreaterThanOrEqual(1);
    runs.forEach(d => { expect(d.getMonth()).toBe(1); expect(d.getDate()).toBe(29); });
  });
});
