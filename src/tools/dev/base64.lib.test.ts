import { describe, it, expect } from 'vitest';
import { encodeBase64, decodeBase64 } from './base64.lib';

describe('base64', () => {
  it('round-trips ASCII text', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it('round-trips UTF-8 and emoji', () => {
    const text = 'héllo 🌍';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it('handles the empty string', () => {
    expect(encodeBase64('')).toBe('');
    expect(decodeBase64('')).toBe('');
  });

  it('encodes a known vector', () => {
    expect(encodeBase64('hello')).toBe('aGVsbG8=');
  });

  it('decodes a known vector', () => {
    expect(decodeBase64('aGVsbG8=')).toBe('hello');
  });

  it('trims surrounding whitespace before decoding', () => {
    expect(decodeBase64('  aGVsbG8=  \n')).toBe('hello');
  });
});
