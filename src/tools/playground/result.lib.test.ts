import { describe, it, expect } from 'vitest';
import { toCsv, toJson } from './result.lib';

const result = {
  columns: ['id', 'name'],
  rows: [[1, 'Ann'], [2, 'B,x']],
};

describe('toCsv', () => {
  it('renders a header and quotes fields with commas', () => {
    expect(toCsv(result)).toBe('id,name\n1,Ann\n2,"B,x"');
  });
  it('escapes embedded quotes and nulls', () => {
    expect(toCsv({ columns: ['a'], rows: [['he"llo'], [null]] })).toBe('a\n"he""llo"\n');
  });
});

describe('toJson', () => {
  it('maps columns to values per row', () => {
    expect(JSON.parse(toJson(result))).toEqual([
      { id: 1, name: 'Ann' },
      { id: 2, name: 'B,x' },
    ]);
  });
});
