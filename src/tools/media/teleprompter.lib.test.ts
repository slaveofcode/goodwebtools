import { describe, it, expect } from 'vitest';
import { tokenize, advanceReading, readingTime, scrollSpeed } from './teleprompter.lib';

describe('tokenize', () => {
  it('splits words with offsets and a normalized form', () => {
    const t = tokenize('Hello, World!');
    expect(t.map(x => x.text)).toEqual(['Hello,', 'World!']);
    expect(t.map(x => x.norm)).toEqual(['hello', 'world']);
    expect(t[0]).toMatchObject({ start: 0, end: 6 });
    expect('Hello, World!'.slice(t[1].start, t[1].end)).toBe('World!');
  });
  it('drops tokens that normalize to nothing but keeps real words', () => {
    expect(tokenize('  —  ok  ').map(x => x.norm)).toEqual(['ok']);
    expect(tokenize('')).toEqual([]);
  });
  it('keeps digits and apostrophes in the normalized form', () => {
    expect(tokenize("It's 2026").map(x => x.norm)).toEqual(["it's", '2026']);
  });
});

describe('advanceReading', () => {
  const script = tokenize('the quick brown fox jumps over the lazy dog').map(t => t.norm);
  it('advances one word when the next word is spoken', () => {
    expect(advanceReading(script, 0, ['the'])).toBe(1);
    expect(advanceReading(script, 1, ['quick'])).toBe(2);
  });
  it('advances to the furthest correctly-read word in a chunk', () => {
    expect(advanceReading(script, 0, ['the', 'quick', 'brown'])).toBe(3);
  });
  it('ignores filler / misheard words and holds position', () => {
    expect(advanceReading(script, 2, ['um', 'errr'])).toBe(2);
  });
  it('catches up after a skipped word within the lookahead window', () => {
    // reader at "quick" (idx1) but says "fox" (idx3) — skip is tolerated
    expect(advanceReading(script, 1, ['fox'])).toBe(4);
  });
  it('never moves backward', () => {
    // "quick" (idx 1) is behind position 5 and does not recur ahead → no move.
    expect(advanceReading(script, 5, ['quick'])).toBe(5);
  });
  it('advances to a later occurrence of a repeated word', () => {
    // At "over" (idx 5), reading "the" matches the SECOND "the" (idx 6).
    expect(advanceReading(script, 5, ['the'])).toBe(7);
  });
  it('does not jump on a coincidental far-ahead match beyond lookahead', () => {
    expect(advanceReading(script, 0, ['dog'], 4)).toBe(0);
  });
  it('stays in bounds at the end', () => {
    expect(advanceReading(script, script.length, ['dog'])).toBe(script.length);
  });
});

describe('readingTime', () => {
  it('is words / wpm in seconds', () => {
    expect(readingTime(130, 130)).toBe(60);
    expect(readingTime(0, 130)).toBe(0);
    expect(readingTime(65, 0)).toBe(0); // guard divide-by-zero
  });
});

describe('scrollSpeed', () => {
  it('scales with wpm and px-per-word', () => {
    expect(scrollSpeed(120, 30)).toBeCloseTo((120 / 60) * 30); // 60 px/sec
    expect(scrollSpeed(0, 30)).toBe(0);
  });
});
