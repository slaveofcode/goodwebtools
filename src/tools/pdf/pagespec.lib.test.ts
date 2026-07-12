import { describe, it, expect } from 'vitest';
import { parsePageSpec } from './pdf.lib';

describe('parsePageSpec', () => {
  it('parses a comma-separated list of single pages', () => {
    expect(parsePageSpec('1, 3, 7, 10')).toEqual([1, 3, 7, 10]);
  });

  it('expands ascending ranges', () => {
    expect(parsePageSpec('2-5')).toEqual([2, 3, 4, 5]);
  });

  it('expands descending ranges in descending order', () => {
    expect(parsePageSpec('5-1')).toEqual([5, 4, 3, 2, 1]);
  });

  it('mixes ranges and singles, preserving order', () => {
    expect(parsePageSpec('1-3, 5, 8-10')).toEqual([1, 2, 3, 5, 8, 9, 10]);
  });

  it('de-duplicates while keeping first-seen order', () => {
    expect(parsePageSpec('2-5, 8, 5')).toEqual([2, 3, 4, 5, 8]);
  });

  it('ignores blanks, junk, and page 0', () => {
    expect(parsePageSpec('  1 , , abc, 0, 3 ')).toEqual([1, 3]);
  });

  it('returns an empty array for empty input', () => {
    expect(parsePageSpec('')).toEqual([]);
    expect(parsePageSpec('   ')).toEqual([]);
  });
});
