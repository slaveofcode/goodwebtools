import { describe, it, expect } from 'vitest';
import { splitIntoChunks } from './tts.lib';

describe('splitIntoChunks', () => {
  it('returns a single chunk for short text', () => {
    expect(splitIntoChunks('Hello world.')).toEqual(['Hello world.']);
  });

  it('returns [] for empty or whitespace', () => {
    expect(splitIntoChunks('')).toEqual([]);
    expect(splitIntoChunks('   \n  ')).toEqual([]);
  });

  it('never exceeds maxLen per chunk', () => {
    const text = 'One. Two. Three. Four. Five. Six. Seven. Eight.';
    const chunks = splitIntoChunks(text, 12);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(12);
  });

  it('hard-splits a single sentence longer than maxLen', () => {
    const chunks = splitIntoChunks('A'.repeat(250), 100);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });

  it('preserves all non-space characters', () => {
    const text = 'The quick brown fox. Jumps over! The lazy dog?';
    const joined = splitIntoChunks(text, 15).join(' ').replace(/\s+/g, '');
    expect(joined).toBe(text.replace(/\s+/g, ''));
  });
});
