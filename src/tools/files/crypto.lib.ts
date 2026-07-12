/**
 * Client-side file encryption with AES-256-GCM and a PBKDF2-derived key.
 * The output file is self-describing: a small header carries the version,
 * the random salt, and the random IV, followed by the GCM ciphertext (which
 * includes the authentication tag). Nothing leaves the browser.
 */

// "GWTENC" — identifies our container format.
const MAGIC = new Uint8Array([0x47, 0x57, 0x54, 0x45, 0x4e, 0x43]);
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12;
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN;
const ITERATIONS = 250_000;

/** File extension appended to encrypted files. */
export const ENCRYPTED_EXT = 'gwtenc';

/** Build the container header from a salt and IV. */
export function packHeader(salt: Uint8Array, iv: Uint8Array): Uint8Array {
  if (salt.length !== SALT_LEN) throw new Error('Invalid salt length.');
  if (iv.length !== IV_LEN) throw new Error('Invalid IV length.');
  const out = new Uint8Array(HEADER_LEN);
  out.set(MAGIC, 0);
  out[MAGIC.length] = VERSION;
  out.set(salt, MAGIC.length + 1);
  out.set(iv, MAGIC.length + 1 + SALT_LEN);
  return out;
}

export interface ParsedHeader {
  version: number;
  salt: Uint8Array;
  iv: Uint8Array;
  /** Byte offset where the ciphertext begins. */
  dataOffset: number;
}

/** Validate and read the container header. Throws with a clear message. */
export function parseHeader(bytes: Uint8Array): ParsedHeader {
  if (bytes.length < HEADER_LEN) {
    throw new Error('This file is too small to be a GoodWebTools-encrypted file.');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error('This is not a GoodWebTools-encrypted (.gwtenc) file.');
  }
  const version = bytes[MAGIC.length];
  if (version !== VERSION) throw new Error(`Unsupported file version (${version}).`);
  return {
    version,
    salt: bytes.slice(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN),
    iv: bytes.slice(MAGIC.length + 1 + SALT_LEN, HEADER_LEN),
    dataOffset: HEADER_LEN,
  };
}

/** Suggest an output name for an encrypted file. */
export function encryptedName(name: string): string {
  return `${name}.${ENCRYPTED_EXT}`;
}

/** Suggest an output name for a decrypted file (strip the .gwtenc suffix). */
export function decryptedName(name: string): string {
  const suffix = `.${ENCRYPTED_EXT}`;
  if (name.toLowerCase().endsWith(suffix)) return name.slice(0, -suffix.length);
  return `${name}.decrypted`;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt raw bytes, returning the full container (header + ciphertext). */
export async function encryptData(data: ArrayBuffer, password: string): Promise<Uint8Array> {
  if (!password) throw new Error('Enter a password.');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const header = packHeader(salt, iv);
  const out = new Uint8Array(header.length + cipher.length);
  out.set(header, 0);
  out.set(cipher, header.length);
  return out;
}

/** Decrypt a container produced by encryptData. Throws on wrong password. */
export async function decryptData(fileBytes: Uint8Array, password: string): Promise<Uint8Array> {
  if (!password) throw new Error('Enter a password.');
  const { salt, iv, dataOffset } = parseHeader(fileBytes);
  const key = await deriveKey(password, salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fileBytes.slice(dataOffset));
    return new Uint8Array(plain);
  } catch {
    throw new Error('Wrong password, or the file is corrupted.');
  }
}
