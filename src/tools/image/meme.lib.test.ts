import { describe, it, expect } from 'vitest';
import { wrapText } from './meme.lib';

// Fake text measurer: one unit per character.
const measure = (s: string) => s.length;

describe('wrapText', () => {
  it('keeps short text on one line', () => {
    expect(wrapText('HELLO', 10, measure)).toEqual(['HELLO']);
  });

  it('wraps on word boundaries to fit the width', () => {
    expect(wrapText('ONE TWO THREE', 7, measure)).toEqual(['ONE TWO', 'THREE']);
  });

  it('hard-breaks a single word longer than the width', () => {
    expect(wrapText('SUPERCALI', 4, measure)).toEqual(['SUPE', 'RCAL', 'I']);
  });

  it('returns [] for empty text', () => {
    expect(wrapText('', 10, measure)).toEqual([]);
    expect(wrapText('   ', 10, measure)).toEqual([]);
  });
});
