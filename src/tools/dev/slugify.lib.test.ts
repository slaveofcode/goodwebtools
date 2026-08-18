import { describe, it, expect } from 'vitest';
import { slugify } from './slugify.lib';

describe('slugify', () => {
  it('lowercases and hyphenates a basic phrase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('collapses runs of punctuation and spaces into one separator', () => {
    expect(slugify('  Foo --- bar!!!  baz  ')).toBe('foo-bar-baz');
  });

  it('folds accents/diacritics', () => {
    expect(slugify('Crème brûlée à la mode')).toBe('creme-brulee-a-la-mode');
  });

  it('keeps digits', () => {
    expect(slugify('Top 10 Things in 2026')).toBe('top-10-things-in-2026');
  });

  it('honours a custom separator', () => {
    expect(slugify('Hello World', { separator: '_' })).toBe('hello_world');
  });

  it('can preserve case', () => {
    expect(slugify('Hello World', { lowercase: false })).toBe('Hello-World');
  });

  it('returns an empty string for empty or symbol-only input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('—/—')).toBe('');
  });

  it('drops non-latin characters when stripping diacritics', () => {
    expect(slugify('café ☕ time')).toBe('cafe-time');
  });
});
