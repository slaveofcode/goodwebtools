import { describe, it, expect } from 'vitest';
import { hashToHex, hashFile } from './hash.lib';

describe('hashToHex', () => {
  it('formats bytes as zero-padded lowercase hex', () => {
    expect(hashToHex(new Uint8Array([255, 0, 16, 10]))).toBe('ff00100a');
  });

  it('returns an empty string for empty input', () => {
    expect(hashToHex(new Uint8Array([]))).toBe('');
  });
});

describe('hashFile (SHA-256)', () => {
  const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

  it('matches the known digest of "abc"', async () => {
    const hex = await hashFile(encode('abc'));
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches the known digest of the empty input', async () => {
    const hex = await hashFile(new ArrayBuffer(0));
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('produces a 64-char lowercase hex string', async () => {
    const hex = await hashFile(encode('goodwebtools'));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
});
