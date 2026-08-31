import { describe, it, expect } from 'vitest';
import { EN_ANSWERS, EN_EXTRA, ID_ANSWERS, ID_EXTRA, wordSets } from './wordguess.words';

const FIVE = /^[a-z]{5}$/;

describe('word list shape', () => {
  it.each([
    ['EN_ANSWERS', EN_ANSWERS, 800],
    ['EN_EXTRA', EN_EXTRA, 100],
    ['ID_ANSWERS', ID_ANSWERS, 400],
    ['ID_EXTRA', ID_EXTRA, 100],
  ])('%s: all words are 5 lowercase a–z letters and above the minimum size', (_name, list, min) => {
    expect(list.length).toBeGreaterThanOrEqual(min);
    for (const w of list) expect(w).toMatch(FIVE);
  });

  it.each([
    ['EN_ANSWERS', EN_ANSWERS],
    ['EN_EXTRA', EN_EXTRA],
    ['ID_ANSWERS', ID_ANSWERS],
    ['ID_EXTRA', ID_EXTRA],
  ])('%s: no duplicates', (_name, list) => {
    expect(new Set(list).size).toBe(list.length);
  });

  it('no word is both an EN answer and an ID answer', () => {
    const en = new Set(EN_ANSWERS);
    const overlap = ID_ANSWERS.filter(w => en.has(w));
    expect(overlap).toEqual([]);
  });
});

describe('wordSets', () => {
  it('valid ⊇ answers for both languages', () => {
    for (const lang of ['en', 'id'] as const) {
      const { answers, valid } = wordSets(lang);
      for (const w of answers) expect(valid.has(w)).toBe(true);
    }
  });

  it('returns distinct lists per language', () => {
    const en = wordSets('en');
    const id = wordSets('id');
    expect(en.answers.includes('crane')).toBe(true);
    expect(id.answers.includes('crane')).toBe(false);
  });
});
