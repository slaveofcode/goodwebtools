import { describe, it, expect } from 'vitest';
import { GLYPHS, searchGlyphs } from './emoji.lib';

describe('emoji/special-char picker', () => {
  it('finds emoji by keyword', () => {
    expect(searchGlyphs('lol').map((g) => g.char)).toContain('😂');
  });

  it('finds special characters people search for', () => {
    expect(searchGlyphs('em dash')[0].char).toBe('—');
    expect(searchGlyphs('degree')[0].char).toBe('°');
    expect(searchGlyphs('shift').map((g) => g.char)).toContain('⇧');
  });

  it('finds currency symbols', () => {
    expect(searchGlyphs('euro')[0].char).toBe('€');
  });

  it('matches an exact character query', () => {
    expect(searchGlyphs('±')[0].name).toBe('plus-minus');
  });

  it('returns everything for an empty query', () => {
    expect(searchGlyphs('')).toHaveLength(GLYPHS.length);
  });

  it('returns nothing for gibberish', () => {
    expect(searchGlyphs('zzzxqq')).toHaveLength(0);
  });
});
