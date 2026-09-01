import { describe, it, expect } from 'vitest';
import { sortTextLines } from './sort-lines.lib';

describe('sortTextLines', () => {
  it('sorts ascending by default', () => {
    expect(sortTextLines('b\na\nc')).toBe('a\nb\nc');
  });
  it('sorts descending', () => {
    expect(sortTextLines('b\na\nc', { direction: 'desc' })).toBe('c\nb\na');
  });
  it('reverses without sorting', () => {
    expect(sortTextLines('b\na\nc', { direction: 'reverse' })).toBe('c\na\nb');
  });
  it('case-insensitive ordering', () => {
    expect(sortTextLines('B\na\nC', { caseInsensitive: true })).toBe('a\nB\nC');
  });
  it('natural (numeric) ordering', () => {
    expect(sortTextLines('item10\nitem2\nitem1', { natural: true })).toBe('item1\nitem2\nitem10');
  });
  it('sorts by the key before = or :', () => {
    expect(sortTextLines('B=2\nA=1\nC=3', { byKey: true })).toBe('A=1\nB=2\nC=3');
    expect(sortTextLines('B: two\nA: one', { byKey: true })).toBe('A: one\nB: two');
  });
  it('dedupes lines', () => {
    expect(sortTextLines('a\na\nb', { dedupe: true })).toBe('a\nb');
  });
  it('trims each line and drops blanks', () => {
    expect(sortTextLines(' b \n\n a ', { trimEach: true, dropBlanks: true })).toBe('a\nb');
  });
  it('trims specific characters from both ends', () => {
    expect(sortTextLines('"b"\n"a"', { trimChars: '"' })).toBe('a\nb');
    expect(sortTextLines("A=1,\nB=2,", { trimChars: ',', byKey: true })).toBe('A=1\nB=2');
  });
  it('combines env-style: sort by key, case-insensitive, dedupe', () => {
    const input = 'db_host=x\nAPI_KEY=1\napi_key=1\nZONE=us';
    expect(sortTextLines(input, { byKey: true, caseInsensitive: true, dedupe: true }))
      .toBe('API_KEY=1\napi_key=1\ndb_host=x\nZONE=us');
  });
  it('returns empty for empty input', () => {
    expect(sortTextLines('', { dropBlanks: true })).toBe('');
  });
});
