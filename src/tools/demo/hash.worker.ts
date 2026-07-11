import { expose } from 'comlink';
import { hashFile } from './hash.lib';

const api = {
  async hashFile(
    fileBuffer: ArrayBuffer,
    onProgress: (percent: number) => void
  ): Promise<string> {
    onProgress(50);
    const hash = await hashFile(fileBuffer);
    onProgress(100);
    return hash;
  }
};

export type HashWorkerAPI = typeof api;
expose(api);
