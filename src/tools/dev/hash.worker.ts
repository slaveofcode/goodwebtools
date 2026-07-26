import { expose } from 'comlink';
import { createMD5, createSHA1, createSHA256, createSHA512, type IHasher } from 'hash-wasm';
import type { HashAlgorithm } from './hash.lib';

const factories: Record<HashAlgorithm, () => Promise<IHasher>> = {
  md5: createMD5,
  'sha-1': createSHA1,
  'sha-256': createSHA256,
  'sha-512': createSHA512,
};

// 8 MB chunks: read the file incrementally so multi-GB files hash without
// loading the whole thing into memory. Blobs cross the worker boundary by
// reference, so slicing here stays cheap.
const CHUNK = 8 * 1024 * 1024;

const api = {
  async hashFile(
    file: File,
    algorithm: HashAlgorithm,
    onProgress: (percent: number) => void
  ): Promise<string> {
    const factory = factories[algorithm];
    if (!factory) throw new Error(`Unsupported algorithm: ${algorithm}`);
    const hasher = await factory();
    hasher.init();

    if (file.size === 0) {
      onProgress(100);
      return hasher.digest('hex');
    }

    for (let offset = 0; offset < file.size; offset += CHUNK) {
      const chunk = await file.slice(offset, offset + CHUNK).arrayBuffer();
      hasher.update(new Uint8Array(chunk));
      onProgress(Math.min(100, Math.round(((offset + CHUNK) / file.size) * 100)));
    }
    return hasher.digest('hex');
  },
};

export type HashWorkerAPI = typeof api;
expose(api);
