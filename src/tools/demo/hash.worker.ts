import { expose } from 'comlink';
import { hashFile } from './hash.lib';

const api = {
  async hashFile(
    fileBuffer: ArrayBuffer,
    onProgress: (percent: number) => void
  ): Promise<string> {
    onProgress(10);
    const hashHex = await hashFile(fileBuffer);
    onProgress(100);
    return hashHex;
  }
};

export type HashWorkerAPI = typeof api;
expose(api);
