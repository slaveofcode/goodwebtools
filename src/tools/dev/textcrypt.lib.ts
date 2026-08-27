/**
 * Password-based text encryption with the Web Crypto API — AES-GCM with a key
 * derived via PBKDF2 (SHA-256). Pure and testable: the output is a self-
 * contained Base64 blob of salt + IV + ciphertext, so decryption needs only the
 * blob and the password. No key or plaintext ever leaves the browser.
 */

const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt `plain` with `password`; returns a Base64 blob (salt + IV + ciphertext). */
export async function encryptText(plain: string, password: string): Promise<string> {
  if (!password) throw new Error('Password required');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  ));
  const blob = new Uint8Array(salt.length + iv.length + ct.length);
  blob.set(salt, 0);
  blob.set(iv, salt.length);
  blob.set(ct, salt.length + iv.length);
  return bytesToBase64(blob);
}

/** Decrypt a Base64 blob produced by {@link encryptText}. Throws on wrong password/corrupt data. */
export async function decryptText(payload: string, password: string): Promise<string> {
  if (!password) throw new Error('Password required');
  let blob: Uint8Array;
  try {
    blob = base64ToBytes(payload.trim());
  } catch {
    throw new Error('Not valid encrypted text');
  }
  if (blob.length <= SALT_BYTES + IV_BYTES) throw new Error('Not valid encrypted text');
  const salt = blob.slice(0, SALT_BYTES);
  const iv = blob.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ct = blob.slice(SALT_BYTES + IV_BYTES);
  const key = await deriveKey(password, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}
