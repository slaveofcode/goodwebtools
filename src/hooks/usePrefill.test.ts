import { describe, it, expect } from 'vitest';
import { parsePrefill } from './usePrefill';

describe('parsePrefill', () => {
  it('parses size', () => {
    expect(parsePrefill('?size=8MB').size).toEqual({ value: 8, unit: 'MB' });
  });
  it('parses number, text, url', () => {
    expect(parsePrefill('?n=2024').number).toBe(2024);
    expect(parsePrefill('?text=hello%20world').text).toBe('hello world');
    expect(parsePrefill('?url=https://x.com').url).toBe('https://x.com');
  });
  it('ignores malformed size and empty search', () => {
    expect(parsePrefill('?size=abc').size).toBeUndefined();
    expect(parsePrefill('')).toEqual({});
  });
});
