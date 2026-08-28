import { describe, it, expect } from 'vitest';
import { dedupeCsvRows, toCsv } from './office.lib';

describe('dedupeCsvRows', () => {
  it('drops duplicate rows and keeps the first (incl. header)', () => {
    const csv = 'name,qty\nApple,3\nBanana,5\nApple,3\nBanana,5\nCherry,2';
    const { csv: out, removed } = dedupeCsvRows(csv);
    expect(removed).toBe(2);
    expect(out.split('\n')).toEqual(['name,qty', 'Apple,3', 'Banana,5', 'Cherry,2']);
  });
  it('is a no-op when there are no duplicates', () => {
    const { removed } = dedupeCsvRows('a,b\n1,2\n3,4');
    expect(removed).toBe(0);
  });
});

describe('toCsv', () => {
  it('quotes cells containing commas, quotes or newlines', () => {
    expect(toCsv([['a', 'x,y'], ['b', 'he said "hi"']])).toBe('a,"x,y"\nb,"he said ""hi"""');
  });
});
