import { describe, it, expect } from 'vitest';
import { generateLorem } from './lorem.lib';

describe('generateLorem', () => {
  it('produces the requested number of words', () => {
    const out = generateLorem({ unit: 'words', count: 10, seed: 42 });
    expect(out.split(/\s+/)).toHaveLength(10);
  });

  it('starts with the classic opener when asked', () => {
    const out = generateLorem({ unit: 'words', count: 5, startWithLorem: true, seed: 1 });
    expect(out.toLowerCase()).toBe('lorem ipsum dolor sit amet');
  });

  it('can skip the classic opener', () => {
    const out = generateLorem({ unit: 'words', count: 5, startWithLorem: false, seed: 1 });
    expect(out.toLowerCase().startsWith('lorem ipsum dolor sit amet')).toBe(false);
  });

  it('produces the requested number of sentences', () => {
    const out = generateLorem({ unit: 'sentences', count: 4, seed: 7 });
    expect(out.match(/[.!?]/g)?.length).toBe(4);
    expect(out[0]).toBe(out[0].toUpperCase());
  });

  it('produces the requested number of paragraphs', () => {
    const out = generateLorem({ unit: 'paragraphs', count: 3, seed: 9 });
    expect(out.split('\n\n')).toHaveLength(3);
  });

  it('is reproducible for a given seed', () => {
    expect(generateLorem({ count: 2, seed: 123 })).toBe(generateLorem({ count: 2, seed: 123 }));
  });

  it('returns empty for a zero count', () => {
    expect(generateLorem({ unit: 'words', count: 0 })).toBe('');
  });

  it('ends sentences with a period', () => {
    const out = generateLorem({ unit: 'sentences', count: 1, seed: 3 });
    expect(out.trim().endsWith('.')).toBe(true);
  });
});
