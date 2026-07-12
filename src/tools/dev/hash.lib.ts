export type HashAlgorithm = 'md5' | 'sha-1' | 'sha-256' | 'sha-512';

export const HASH_ALGORITHMS: { key: HashAlgorithm; label: string; ext: string }[] = [
  { key: 'md5', label: 'MD5', ext: 'md5' },
  { key: 'sha-1', label: 'SHA-1', ext: 'sha1' },
  { key: 'sha-256', label: 'SHA-256', ext: 'sha256' },
  { key: 'sha-512', label: 'SHA-512', ext: 'sha512' },
];

export function hashToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashFile(fileBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return hashToHex(hashArray);
}
