import { describe, it, expect } from 'vitest';
import { compareLines } from './lineset.lib';

const run = (a: string, b: string, mode: Parameters<typeof compareLines>[2], opts = {}) =>
  compareLines(a, b, mode, opts).lines;

describe('compareLines — union (merge & dedupe)', () => {
  it('combines both sources, A first, deduped', () => {
    expect(run('a\nb\nc', 'b\nc\nd', 'union')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('removes duplicates within a single source too', () => {
    expect(run('a\na\nb', '', 'union')).toEqual(['a', 'b']);
  });
});

describe('compareLines — difference (A − B)', () => {
  it('keeps A lines not present in B', () => {
    expect(run('a\nb\nc', 'b', 'difference')).toEqual(['a', 'c']);
  });
  it('result is deduped and in A order', () => {
    expect(run('a\nc\na\nd', 'd', 'difference')).toEqual(['a', 'c']);
  });
});

describe('compareLines — intersection (B lines found in A)', () => {
  it('returns B lines that appear in A, in B order, deduped', () => {
    expect(run('a\nb\nc', 'c\nd\nc\nb', 'intersection')).toEqual(['c', 'b']);
  });
});

describe('compareLines — differenceB (B − A)', () => {
  it('keeps B lines not present in A, in B order, deduped', () => {
    expect(run('a\nb', 'b\nc\nd\nc', 'differenceB')).toEqual(['c', 'd']);
  });
});

describe('compareLines — symmetric (in only one list)', () => {
  it('returns lines unique to A then unique to B', () => {
    expect(run('a\nb\nc', 'b\nc\nd', 'symmetric')).toEqual(['a', 'd']);
  });
});

describe('compareLines — duplicates (2+ across A and B)', () => {
  it('finds lines that appear more than once across both sources', () => {
    expect(run('a\nb\nc', 'c\nd', 'duplicates')).toEqual(['c']);
  });
  it('counts repeats within a single source', () => {
    expect(run('x\nx\ny', '', 'duplicates')).toEqual(['x']);
  });
});

describe('options', () => {
  it('caseInsensitive matches across case, keeping first original casing', () => {
    expect(run('Apple', 'apple', 'difference', { caseInsensitive: true })).toEqual([]);
    expect(run('Apple\nBanana', 'apple', 'union', { caseInsensitive: true })).toEqual(['Apple', 'Banana']);
  });
  it('trim ignores leading/trailing whitespace when comparing', () => {
    expect(run('  a  \nb', 'a', 'difference', { trim: true })).toEqual(['b']);
  });
  it('ignoreBlank drops empty lines', () => {
    expect(run('a\n\n\nb', '', 'union', { ignoreBlank: true })).toEqual(['a', 'b']);
  });
  it('sort orders the output', () => {
    expect(run('c\na\nb', 'd', 'union', { sort: true })).toEqual(['a', 'b', 'c', 'd']);
  });
  it('sort respects caseInsensitive ordering', () => {
    expect(run('B\na\nC', '', 'union', { sort: true, caseInsensitive: true })).toEqual(['a', 'B', 'C']);
  });
});

describe('edge cases', () => {
  it('empty inputs yield empty output', () => {
    expect(run('', '', 'union')).toEqual([]);
    expect(compareLines('', '', 'union', {}).count).toBe(0);
  });
  it('reports the result count', () => {
    expect(compareLines('a\nb\nc', 'c', 'difference', {}).count).toBe(2);
  });
  it('handles CRLF line endings', () => {
    expect(run('a\r\nb\r\nc', 'b', 'difference')).toEqual(['a', 'c']);
  });
});
