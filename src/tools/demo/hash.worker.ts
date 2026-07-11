import { expose } from 'comlink';
import { hashFile } from './hash.lib';

console.log('Hash worker script loaded!');

const api = {
  async hashFile(
    fileBuffer: ArrayBuffer,
    onProgress: (percent: number) => void
  ): Promise<string> {
    console.log('Worker: hashFile called with buffer size:', fileBuffer.byteLength);
    onProgress(50);
    const hash = await hashFile(fileBuffer);
    console.log('Worker: hash computed:', hash);
    onProgress(100);
    return hash;
  }
};

export type HashWorkerAPI = typeof api;

console.log('Worker: Exposing API:', Object.keys(api));
expose(api);
console.log('Worker: API exposed via Comlink');
