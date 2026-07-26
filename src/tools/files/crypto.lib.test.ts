import { describe, expect, it } from 'vitest';
import {
  packHeader,
  parseHeader,
  encryptData,
  decryptData,
  encryptedName,
  decryptedName,
  ENCRYPTED_EXT,
} from './crypto.lib';

const salt = () => new Uint8Array(16).fill(7);
const iv = () => new Uint8Array(12).fill(9);

describe('container header', () => {
  it('round-trips salt and IV through pack/parse', () => {
    const parsed = parseHeader(packHeader(salt(), iv()));
    expect(Array.from(parsed.salt)).toEqual(Array.from(salt()));
    expect(Array.from(parsed.iv)).toEqual(Array.from(iv()));
    expect(parsed.version).toBe(1);
    expect(parsed.dataOffset).toBe(6 + 1 + 16 + 12);
  });

  it('rejects wrong salt/iv lengths', () => {
    expect(() => packHeader(new Uint8Array(8), iv())).toThrow(/salt/i);
    expect(() => packHeader(salt(), new Uint8Array(4))).toThrow(/iv/i);
  });

  it('rejects a file that is too small', () => {
    expect(() => parseHeader(new Uint8Array(5))).toThrow(/too small/i);
  });

  it('rejects a file without the magic bytes', () => {
    const bogus = new Uint8Array(40); // all zeros, no magic
    expect(() => parseHeader(bogus)).toThrow(/not a GoodWebTools/i);
  });
});

describe('output naming', () => {
  it('appends and strips the .gwtenc extension', () => {
    expect(encryptedName('report.pdf')).toBe(`report.pdf.${ENCRYPTED_EXT}`);
    expect(decryptedName(`report.pdf.${ENCRYPTED_EXT}`)).toBe('report.pdf');
    expect(decryptedName('REPORT.PDF.GWTENC')).toBe('REPORT.PDF');
  });

  it('falls back to .decrypted when there is no .gwtenc suffix', () => {
    expect(decryptedName('mystery.bin')).toBe('mystery.bin.decrypted');
  });
});

// WebCrypto is available in the Node/jsdom test runtime.
describe('encrypt/decrypt round-trip', () => {
  const bytes = new TextEncoder().encode('Attack at dawn — 攻撃 🗝️').buffer;

  it('decrypts back to the original with the right password', async () => {
    const enc = await encryptData(bytes, 'correct horse battery staple');
    const dec = await decryptData(enc, 'correct horse battery staple');
    expect(new TextDecoder().decode(dec)).toBe('Attack at dawn — 攻撃 🗝️');
  });

  it('produces different ciphertext each time (random salt/iv)', async () => {
    const a = await encryptData(bytes, 'pw');
    const b = await encryptData(bytes, 'pw');
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('fails to decrypt with the wrong password', async () => {
    const enc = await encryptData(bytes, 'right');
    await expect(decryptData(enc, 'wrong')).rejects.toThrow(/wrong password|corrupted/i);
  });

  it('rejects an empty password', async () => {
    await expect(encryptData(bytes, '')).rejects.toThrow(/password/i);
  });
});
