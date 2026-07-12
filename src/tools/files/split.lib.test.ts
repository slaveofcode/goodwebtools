import { describe, it, expect } from 'vitest';
import { splitRanges, partName, joinedName, naturalCompare } from './split.lib';

describe('splitRanges', () => {
  it('splits evenly', () => {
    expect(splitRanges(10, 5)).toEqual([
      { index: 0, start: 0, end: 5 },
      { index: 1, start: 5, end: 10 },
    ]);
  });

  it('handles a final partial chunk', () => {
    expect(splitRanges(12, 5)).toEqual([
      { index: 0, start: 0, end: 5 },
      { index: 1, start: 5, end: 10 },
      { index: 2, start: 10, end: 12 },
    ]);
  });

  it('returns one range when the chunk is larger than the file', () => {
    expect(splitRanges(3, 100)).toEqual([{ index: 0, start: 0, end: 3 }]);
  });

  it('returns nothing for an empty file', () => {
    expect(splitRanges(0, 10)).toEqual([]);
  });

  it('rejects a non-positive chunk size', () => {
    expect(() => splitRanges(10, 0)).toThrow(/greater than 0/i);
  });
});

describe('partName', () => {
  it('zero-pads to at least 3 digits', () => {
    expect(partName('a.zip', 0, 5)).toBe('a.zip.001');
    expect(partName('a.zip', 9, 5)).toBe('a.zip.010');
  });

  it('widens padding when there are many parts', () => {
    expect(partName('a.zip', 0, 1200)).toBe('a.zip.0001');
  });
});

describe('joinedName', () => {
  it('strips a trailing .NNN suffix', () => {
    expect(joinedName('report.pdf.001')).toBe('report.pdf');
    expect(joinedName('archive.zip.0001')).toBe('archive.zip');
  });

  it('falls back when there is no part suffix', () => {
    expect(joinedName('plain.bin')).toBe('plain.bin.joined');
  });
});

describe('naturalCompare', () => {
  it('orders numeric suffixes naturally', () => {
    const parts = ['f.10', 'f.2', 'f.1'];
    expect([...parts].sort(naturalCompare)).toEqual(['f.1', 'f.2', 'f.10']);
  });
});
