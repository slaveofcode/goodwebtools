import { zipSync, unzipSync } from 'fflate';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Create a .zip archive from a list of files, entirely in the browser.
 * Uses DEFLATE level 6 (a good speed/size balance).
 */
export function createZip(entries: ZipEntry[]): Uint8Array {
  if (entries.length === 0) throw new Error('Add at least one file to zip.');
  const map: Record<string, Uint8Array> = {};
  for (const { name, data } of entries) map[name] = data;
  return zipSync(map, { level: 6 });
}

/**
 * Extract a .zip archive into its files. Directory entries (names ending in
 * "/") are omitted. Throws with a clear message on a corrupt/non-zip input.
 */
export function extractZip(data: Uint8Array): ZipEntry[] {
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(data);
  } catch {
    throw new Error('This file is not a valid .zip archive.');
  }
  return Object.entries(unzipped)
    .filter(([name]) => !name.endsWith('/'))
    .map(([name, bytes]) => ({ name, data: bytes }));
}
