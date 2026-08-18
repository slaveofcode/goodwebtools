import { describe, it, expect } from 'vitest';
import { TEST_COLORS, stepIndex } from './screen-test.lib';

describe('screen-test', () => {
  it('includes the primaries plus white and black', () => {
    const hexes = TEST_COLORS.map((c) => c.hex);
    for (const h of ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff']) {
      expect(hexes).toContain(h);
    }
  });

  it('steps forward and wraps at the end', () => {
    expect(stepIndex(0, 1, 9)).toBe(1);
    expect(stepIndex(8, 1, 9)).toBe(0);
  });

  it('steps backward and wraps at the start', () => {
    expect(stepIndex(0, -1, 9)).toBe(8);
  });

  it('every colour has a readable foreground', () => {
    expect(TEST_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c.fg))).toBe(true);
  });
});
