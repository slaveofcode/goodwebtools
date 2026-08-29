import { describe, it, expect } from 'vitest';
import { parsePageRange } from './pagerange.lib';

describe('parsePageRange', () => {
  it('expands ranges and singles, sorted and de-duped', () => {
    expect(parsePageRange('1-3,5,7-9')).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });
  it('handles reversed ranges and whitespace', () => {
    expect(parsePageRange(' 9 - 7 , 2 ')).toEqual([2, 7, 8, 9]);
  });
  it('ignores junk and drops non-positive pages', () => {
    expect(parsePageRange('0, abc, 3, -1')).toEqual([3]);
    expect(parsePageRange('')).toEqual([]);
  });
});
