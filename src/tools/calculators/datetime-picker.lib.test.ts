import { describe, it, expect } from 'vitest';
import {
  parseLocalValue,
  toLocalValue,
  sameDay,
  addDays,
  buildMonthGrid,
  to12h,
  from12h,
  presetDate,
} from './datetime-picker.lib';

describe('parseLocalValue', () => {
  it('parses a valid local value', () => {
    const d = parseLocalValue('2026-09-09T15:30');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8); // September
    expect(d!.getDate()).toBe(9);
    expect(d!.getHours()).toBe(15);
    expect(d!.getMinutes()).toBe(30);
  });

  it.each(['', 'not-a-date', '2026-13-01T00:00', '2026-02-31T00:00', '2026-09-09T25:00', '2026-09-09T10:70'])(
    'rejects invalid value %j',
    v => expect(parseLocalValue(v)).toBeNull(),
  );

  it('round-trips with toLocalValue', () => {
    const v = '2026-01-05T08:07';
    expect(toLocalValue(parseLocalValue(v)!)).toBe(v);
  });
});

describe('toLocalValue', () => {
  it('zero-pads month, day, hour and minute', () => {
    expect(toLocalValue(new Date(2026, 0, 3, 4, 5))).toBe('2026-01-03T04:05');
  });
});

describe('sameDay', () => {
  it('ignores the time of day', () => {
    expect(sameDay(new Date(2026, 8, 9, 0, 0), new Date(2026, 8, 9, 23, 59))).toBe(true);
    expect(sameDay(new Date(2026, 8, 9), new Date(2026, 8, 10))).toBe(false);
  });
});

describe('addDays', () => {
  it('crosses a month boundary and keeps the time', () => {
    const d = addDays(new Date(2026, 8, 30, 14, 15), 2);
    expect(d.getMonth()).toBe(9); // October
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(15);
  });
});

describe('buildMonthGrid', () => {
  it('always returns 42 cells', () => {
    expect(buildMonthGrid(2026, 8)).toHaveLength(42);
  });

  it('starts on a Sunday and marks in-month days', () => {
    const cells = buildMonthGrid(2026, 8); // Sep 2026 (1st is a Tuesday)
    expect(cells[0].date.getDay()).toBe(0); // Sunday
    const firstInMonth = cells.find(c => c.inMonth)!;
    expect(firstInMonth.date.getDate()).toBe(1);
    expect(cells.filter(c => c.inMonth)).toHaveLength(30); // September has 30 days
  });

  it('handles a January grid without leaking December as in-month', () => {
    const cells = buildMonthGrid(2026, 0);
    expect(cells.filter(c => c.inMonth)).toHaveLength(31);
    expect(cells.filter(c => c.inMonth).every(c => c.date.getFullYear() === 2026)).toBe(true);
  });
});

describe('to12h / from12h', () => {
  it.each([
    [0, 12, 'AM'],
    [1, 1, 'AM'],
    [11, 11, 'AM'],
    [12, 12, 'PM'],
    [13, 1, 'PM'],
    [23, 11, 'PM'],
  ] as const)('to12h(%i) → %i %s', (h24, h12, ampm) => {
    expect(to12h(h24)).toEqual({ hour12: h12, ampm });
  });

  it('round-trips every hour', () => {
    for (let h = 0; h < 24; h++) {
      const { hour12, ampm } = to12h(h);
      expect(from12h(hour12, ampm)).toBe(h);
    }
  });
});

describe('presetDate', () => {
  const now = new Date(2026, 8, 9, 15, 30); // Sep 9 2026, 15:30

  it('tomorrow → next day at 09:00', () => {
    const d = presetDate('tomorrow', now);
    expect(d.getDate()).toBe(10);
    expect(d.getMonth()).toBe(8);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it('nextWeek → +7 days at 09:00', () => {
    const d = presetDate('nextWeek', now);
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(9);
  });

  it('newYear → Jan 1 of next year at midnight', () => {
    const d = presetDate('newYear', now);
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });
});
