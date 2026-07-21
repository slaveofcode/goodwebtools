// src/services/download/index.ts
import { isTauri } from '../platform';
import type { DownloadService, BlobFile } from './types';

let instance: DownloadService | null = null;

async function getInstance(): Promise<DownloadService> {
  if (instance) return instance;

  if (isTauri()) {
    const { TauriDownloadService } = await import('./tauri');
    instance = new TauriDownloadService();
  } else {
    const { BrowserDownloadService } = await import('./browser');
    instance = new BrowserDownloadService();
  }

  return instance;
}

export const downloadService = {
  async download(blob: Blob, filename: string) {
    const service = await getInstance();
    return service.download(blob, filename);
  },

  async downloadZip(files: BlobFile[], zipName: string) {
    const service = await getInstance();
    return service.downloadZip(files, zipName);
  },

  getCapabilities() {
    if (!instance) {
      return {
        nativeSaveDialog: false,
        zipSupport: false,
      };
    }
    return instance.getCapabilities();
  },
};

export * from './types';
