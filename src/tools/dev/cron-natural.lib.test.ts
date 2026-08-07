import { describe, it, expect } from 'vitest';
import { naturalToCron, extractTime, extractDow, extractDom, extractMonth } from './cron-natural.lib';

function expr(input: string): string {
  const r = naturalToCron(input);
  if (!r.ok) throw new Error(`Parse failed for "${input}": ${r.error}`);
  return r.expr;
}

// ─── naturalToCron — interval patterns ──────────────────────────────────────

describe('naturalToCron — intervals', () => {
  it.each([
    ['every minute',         '* * * * *'],
    ['Every Minute',         '* * * * *'],
    ['every 5 minutes',      '*/5 * * * *'],
    ['every 5 min',          '*/5 * * * *'],
    ['every 15 minutes',     '*/15 * * * *'],
    ['every 30 minutes',     '*/30 * * * *'],
    ['every hour',           '0 * * * *'],
    ['hourly',               '0 * * * *'],
    ['every 2 hours',        '0 */2 * * *'],
    ['every 6 hours',        '0 */6 * * *'],
    ['every 12 hours',       '0 */12 * * *'],
  ])('%s → %s', (input, expected) => {
    expect(expr(input)).toBe(expected);
  });

  it('rejects minute step out of range', () => {
    const r = naturalToCron('every 60 minutes');
    expect(r.ok).toBe(false);
  });

  it('rejects hour step out of range', () => {
    const r = naturalToCron('every 24 hours');
    expect(r.ok).toBe(false);
  });
});

// ─── naturalToCron — daily patterns ─────────────────────────────────────────

describe('naturalToCron — daily', () => {
  it.each([
    ['daily at midnight',    '0 0 * * *'],
    ['every day at midnight','0 0 * * *'],
    ['midnight daily',       '0 0 * * *'],
    ['noon every day',       '0 12 * * *'],
    ['daily at noon',        '0 12 * * *'],
    ['every day at 9am',     '0 9 * * *'],
    ['every day at 9:30am',  '30 9 * * *'],
    ['daily at 14:00',       '0 14 * * *'],
    ['at 3pm every day',     '0 15 * * *'],
    ['at 9',                 '0 9 * * *'],
    ['at midnight',          '0 0 * * *'],
  ])('%s → %s', (input, expected) => {
    expect(expr(input)).toBe(expected);
  });
});

// ─── naturalToCron — weekday / weekend ──────────────────────────────────────

describe('naturalToCron — weekdays/weekends', () => {
  it.each([
    ['every weekday at 9am',       '0 9 * * 1-5'],
    ['weekdays at 9am',            '0 9 * * 1-5'],
    ['monday through friday at 8', '0 8 * * 1-5'],
    ['every weekend at 10am',      '0 10 * * 0,6'],
    ['weekends at midnight',       '0 0 * * 0,6'],
  ])('%s → %s', (input, expected) => {
    expect(expr(input)).toBe(expected);
  });
});

// ─── naturalToCron — specific days ──────────────────────────────────────────

describe('naturalToCron — specific weekdays', () => {
  it.each([
    ['every monday at 9am',              '0 9 * * 1'],
    ['every Monday',                     '0 0 * * 1'],
    ['every friday at noon',             '0 12 * * 5'],
    ['every sunday at midnight',         '0 0 * * 0'],
    ['every monday and wednesday at 8am','0 8 * * 1,3'],
    ['every tuesday thursday at 6pm',    '0 18 * * 2,4'],
    ['every mon wed fri at 9am',         '0 9 * * 1,3,5'],
  ])('%s → %s', (input, expected) => {
    expect(expr(input)).toBe(expected);
  });
});

// ─── naturalToCron — monthly ─────────────────────────────────────────────────

describe('naturalToCron — monthly / dom', () => {
  it.each([
    ['monthly',                    '0 0 1 * *'],
    ['every month',                '0 0 1 * *'],
    ['monthly on the 1st',         '0 0 1 * *'],
    ['every month on the 15th',    '0 0 15 * *'],
    ['on the 1st at midnight',     '0 0 1 * *'],
    ['on the 15th at noon',        '0 12 15 * *'],
  ])('%s → %s', (input, expected) => {
    expect(expr(input)).toBe(expected);
  });
});

// ─── naturalToCron — yearly ──────────────────────────────────────────────────

describe('naturalToCron — yearly', () => {
  it.each([
    ['yearly',                        '0 0 1 1 *'],
    ['annually',                      '0 0 1 1 *'],
    ['every year',                    '0 0 1 1 *'],
    ['every year on January 1st',     '0 0 1 1 *'],
    ['every January 1st at midnight', '0 0 1 1 *'],
    ['on January 15th at 9am',        '0 9 15 1 *'],
    ['every december 25th',           '0 0 25 12 *'],
  ])('%s → %s', (input, expected) => {
    expect(expr(input)).toBe(expected);
  });
});

// ─── naturalToCron — weekly ───────────────────────────────────────────────────

describe('naturalToCron — weekly', () => {
  it.each([
    ['weekly',              '0 0 * * 0'],
    ['every week',          '0 0 * * 0'],
    ['every week at noon',  '0 12 * * 0'],
  ])('%s → %s', (input, expected) => {
    expect(expr(input)).toBe(expected);
  });
});

// ─── naturalToCron — error cases ─────────────────────────────────────────────

describe('naturalToCron — errors', () => {
  it('returns ok:false for empty input', () => {
    expect(naturalToCron('').ok).toBe(false);
  });

  it('returns ok:false for unrecognisable text', () => {
    expect(naturalToCron('random gibberish xyz').ok).toBe(false);
  });
});

// ─── Sub-extractors ──────────────────────────────────────────────────────────

describe('extractTime', () => {
  it.each([
    ['midnight',      { hour: 0,  minute: 0  }],
    ['noon',          { hour: 12, minute: 0  }],
    ['midday',        { hour: 12, minute: 0  }],
    ['at 9am',        { hour: 9,  minute: 0  }],
    ['at 9:30am',     { hour: 9,  minute: 30 }],
    ['at 3pm',        { hour: 15, minute: 0  }],
    ['at 12:00pm',    { hour: 12, minute: 0  }],
    ['at 12:00am',    { hour: 0,  minute: 0  }],
    ['14:30',         { hour: 14, minute: 30 }],
    ['at 0',          { hour: 0,  minute: 0  }],
  ])('%s → %j', (text, expected) => {
    expect(extractTime(text)).toEqual(expected);
  });

  it('returns null when no time is present', () => {
    expect(extractTime('every monday')).toBeNull();
  });
});

describe('extractDow', () => {
  it.each([
    ['weekdays',                '1-5'],
    ['weekends',                '0,6'],
    ['monday',                  '1'],
    ['sunday',                  '0'],
    ['monday and wednesday',    '1,3'],
    ['tue thu',                 '2,4'],
    ['mon wed fri',             '1,3,5'],
  ])('%s → %s', (text, expected) => {
    expect(extractDow(text)).toBe(expected);
  });

  it('returns null with no day names', () => {
    expect(extractDow('at 9am daily')).toBeNull();
  });
});

describe('extractDom', () => {
  it.each([
    ['on the 1st', 1],
    ['on the 15th', 15],
    ['on the 31st', 31],
    ['on the first', 1],
    ['fifteenth', 15],
    ['day 10', 10],
  ])('%s → %d', (text, expected) => {
    expect(extractDom(text)).toBe(expected);
  });

  it('returns null with no ordinal', () => {
    expect(extractDom('every day at 9am')).toBeNull();
  });
});

describe('extractMonth', () => {
  it.each([
    ['january', 1],
    ['jan', 1],
    ['december', 12],
    ['dec', 12],
    ['august', 8],
  ])('%s → %d', (text, expected) => {
    expect(extractMonth(text)).toBe(expected);
  });

  it('returns null with no month', () => {
    expect(extractMonth('every monday')).toBeNull();
  });
});
