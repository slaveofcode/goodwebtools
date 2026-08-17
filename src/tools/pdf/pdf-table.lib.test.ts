import { describe, it, expect } from 'vitest';
import { groupRows, toCsv, type TextItem } from './pdf-table.lib';

const items: TextItem[] = [
  { str: 'Name', x: 0, y: 100 },
  { str: 'Age', x: 80, y: 100 },
  { str: 'Alice', x: 2, y: 80 },
  { str: '30', x: 80, y: 81 },
  { str: 'Bob', x: 1, y: 60 },
  { str: '25', x: 80, y: 60 },
];

describe('groupRows', () => {
  it('groups items into rows by y (within tolerance) and sorts each row by x', () => {
    const rows = groupRows(items, 3);
    expect(rows.map(r => r.map(c => c.str))).toEqual([
      ['Name', 'Age'],
      ['Alice', '30'],
      ['Bob', '25'],
    ]);
  });

  it('returns [] for no items', () => {
    expect(groupRows([], 3)).toEqual([]);
  });
});

describe('toCsv', () => {
  it('joins cells and rows', () => {
    expect(toCsv([[{ str: 'a', x: 0, y: 0 }, { str: 'b', x: 1, y: 0 }]])).toBe('a,b');
  });
  it('quotes cells containing commas, quotes or newlines', () => {
    expect(toCsv([[{ str: 'a, b', x: 0, y: 0 }, { str: 'he said "hi"', x: 1, y: 0 }]]))
      .toBe('"a, b","he said ""hi"""');
  });
});
