import { describe, it, expect } from 'vitest';
import { KEY_ROWS, allCodes, isKnownCode, testedCount } from './keyboard.lib';

describe('keyboard', () => {
  it('has no duplicate codes across the layout', () => {
    const codes = allCodes();
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('includes the common letter, modifier and arrow keys', () => {
    for (const c of ['KeyA', 'Space', 'Enter', 'ShiftLeft', 'F1', 'ArrowUp', 'Escape']) {
      expect(isKnownCode(c)).toBe(true);
    }
  });

  it('rejects codes not in the layout', () => {
    expect(isKnownCode('NumpadEnter')).toBe(false);
    expect(isKnownCode('')).toBe(false);
  });

  it('counts only known tested codes', () => {
    const tested = new Set(['KeyA', 'KeyB', 'NumpadEnter', 'bogus']);
    expect(testedCount(tested)).toBe(2);
  });

  it('every row is non-empty', () => {
    expect(KEY_ROWS.every((r) => r.length > 0)).toBe(true);
  });
});
