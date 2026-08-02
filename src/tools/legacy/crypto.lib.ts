/**
 * Crypto layer for the Digital Legacy Letter. The letter is encrypted with a random
 * 256-bit Data Encryption Key (DEK) using AES-256-GCM. The DEK itself has two
 * independent recovery paths: it can be wrapped by a PBKDF2-derived password key, and
 * it can be Shamir-split into family shares (see shamir.lib). Everything runs in the
 * browser via WebCrypto; nothing is uploaded.
 */

const ITERATIONS = 250_000;
const SALT_LEN = 16;
const IV_LEN = 12;

/** A fresh 256-bit data encryption key. */
export function generateDek(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

async function importAesKey(raw: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, usages);
}

async function deriveKeyFromPassword(password: string, salt: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

export interface Ciphertext {
  iv: Uint8Array;
  ct: Uint8Array;
}

/** Encrypt bytes under the DEK (AES-256-GCM, random IV). */
export async function encryptWithDek(plain: Uint8Array, dek: Uint8Array): Promise<Ciphertext> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await importAesKey(dek, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return { iv, ct };
}

/** Decrypt bytes under the DEK. Throws if the key is wrong or the data is tampered. */
export async function decryptWithDek({ iv, ct }: Ciphertext, dek: Uint8Array): Promise<Uint8Array> {
  const key = await importAesKey(dek, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}

export interface PasswordWrap {
  salt: Uint8Array;
  iters: number;
  iv: Uint8Array;
  ct: Uint8Array;
}

/** Wrap (encrypt) the DEK with a password-derived key. */
export async function wrapDekWithPassword(dek: Uint8Array, password: string): Promise<PasswordWrap> {
  if (!password) throw new Error('Enter a password.');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKeyFromPassword(password, salt, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dek));
  return { salt, iters: ITERATIONS, iv, ct };
}

/** Recover the DEK from a password wrap. Throws on the wrong password. */
export async function unwrapDekWithPassword(wrap: PasswordWrap, password: string): Promise<Uint8Array> {
  if (!password) throw new Error('Enter the password.');
  const key = await deriveKeyFromPassword(password, wrap.salt, ['decrypt']);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: wrap.iv }, key, wrap.ct));
  } catch {
    throw new Error('Wrong password.');
  }
}
