import { describe, it, expect } from 'vitest';
import { encryptText, decryptText } from './textcrypt.lib';

describe('encryptText / decryptText', () => {
  it('round-trips a message', async () => {
    const secret = 'Meet at the docks — bring the plans. 🕵️';
    const blob = await encryptText(secret, 'correct horse');
    expect(blob).not.toContain(secret);
    expect(await decryptText(blob, 'correct horse')).toBe(secret);
  });

  it('produces different ciphertext each time (random salt/iv)', async () => {
    const a = await encryptText('hello', 'pw');
    const b = await encryptText('hello', 'pw');
    expect(a).not.toBe(b);
  });

  it('fails with the wrong password', async () => {
    const blob = await encryptText('hello', 'right');
    await expect(decryptText(blob, 'wrong')).rejects.toThrow();
  });

  it('rejects corrupt or too-short payloads', async () => {
    await expect(decryptText('not base64 @@@', 'pw')).rejects.toThrow();
    await expect(decryptText('AAAA', 'pw')).rejects.toThrow();
  });

  it('requires a password', async () => {
    await expect(encryptText('x', '')).rejects.toThrow();
  });
});
