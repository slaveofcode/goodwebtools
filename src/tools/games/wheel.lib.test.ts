import { describe, it, expect } from 'vitest';
import { parseEntries, chooseIndex, sliceForAngle } from './wheel.lib';

describe('parseEntries', () => {
  it('splits non-empty trimmed lines', () => {
    expect(parseEntries('Alice\n Bob \n\n  \nCarol')).toEqual(['Alice', 'Bob', 'Carol']);
  });
  it('returns [] for empty input', () => {
    expect(parseEntries('   \n  ')).toEqual([]);
  });
});

describe('chooseIndex', () => {
  it('maps a [0,1) value to an index', () => {
    expect(chooseIndex(4, 0)).toBe(0);
    expect(chooseIndex(4, 0.5)).toBe(2);
    expect(chooseIndex(4, 0.999)).toBe(3);
  });
  it('is safe at the upper bound and for empty', () => {
    expect(chooseIndex(4, 1)).toBe(3);
    expect(chooseIndex(0, 0.5)).toBe(-1);
  });
});

describe('sliceForAngle', () => {
  it('maps the pointer angle (at top) to the slice under it', () => {
    // 4 slices of 90°. Pointer at top; angle 0 → first slice.
    expect(sliceForAngle(0, 4)).toBe(0);
    expect(sliceForAngle(95, 4)).toBe(1);
    expect(sliceForAngle(360, 4)).toBe(0); // wraps
  });
});
