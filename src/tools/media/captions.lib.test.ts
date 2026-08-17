import { describe, it, expect } from 'vitest';
import { appendFinal, trimToMaxChars } from './captions.lib';

describe('appendFinal', () => {
  it('joins chunks with a single space', () => {
    expect(appendFinal('Hello', 'world')).toBe('Hello world');
  });
  it('starts fresh from an empty buffer', () => {
    expect(appendFinal('', 'Hi there')).toBe('Hi there');
  });
  it('ignores empty/whitespace chunks', () => {
    expect(appendFinal('Hello', '   ')).toBe('Hello');
  });
});

describe('trimToMaxChars', () => {
  it('keeps text under the limit unchanged', () => {
    expect(trimToMaxChars('short text', 100)).toBe('short text');
  });
  it('keeps only the tail when over the limit, breaking on a word', () => {
    const out = trimToMaxChars('one two three four five', 12);
    expect(out.length).toBeLessThanOrEqual(12);
    expect('one two three four five'.endsWith(out)).toBe(true);
    expect(out.startsWith(' ')).toBe(false);
  });
});
