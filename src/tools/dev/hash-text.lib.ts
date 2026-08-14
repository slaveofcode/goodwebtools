/**
 * Text hashing via hash-wasm (MD5, SHA-1/256/512, CRC32) — dynamic-imported
 * so the wasm stays out of the island chunk.
 */

export type HashAlgo = 'md5' | 'sha1' | 'sha256' | 'sha512' | 'crc32';

export const HASH_ALGOS: { key: HashAlgo; label: string }[] = [
  { key: 'md5', label: 'MD5' },
  { key: 'sha1', label: 'SHA-1' },
  { key: 'sha256', label: 'SHA-256' },
  { key: 'sha512', label: 'SHA-512' },
  { key: 'crc32', label: 'CRC32' },
];

/** Hash a string with the given algorithm, returning a lowercase hex digest. */
export async function hashText(text: string, algo: HashAlgo): Promise<string> {
  const wasm = await import('hash-wasm');
  const fns: Record<HashAlgo, (data: string) => Promise<string>> = {
    md5: wasm.md5,
    sha1: wasm.sha1,
    sha256: wasm.sha256,
    sha512: wasm.sha512,
    crc32: wasm.crc32,
  };
  return fns[algo](text);
}

/** Hash a string with every supported algorithm at once. */
export async function hashAll(text: string): Promise<Record<HashAlgo, string>> {
  const entries = await Promise.all(
    HASH_ALGOS.map(async a => [a.key, await hashText(text, a.key)] as const),
  );
  return Object.fromEntries(entries) as Record<HashAlgo, string>;
}
