import { describe, it, expect } from 'vitest';
import { hashText, hashAll } from './hash-text.lib';

describe('hashText', () => {
  it('computes known digests for "abc"', async () => {
    expect(await hashText('abc', 'md5')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(await hashText('abc', 'sha1')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(await hashText('abc', 'sha256')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(await hashText('abc', 'crc32')).toBe('352441c2');
  });

  it('hashes empty string without error', async () => {
    expect(await hashText('', 'sha256')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('hashAll returns every algorithm', async () => {
    const all = await hashAll('abc');
    expect(Object.keys(all).sort()).toEqual(['crc32', 'md5', 'sha1', 'sha256', 'sha512']);
    expect(all.md5).toBe('900150983cd24fb0d6963f7d28e17f72');
  });
});
