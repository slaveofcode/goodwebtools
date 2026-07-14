// src/services/file/index.ts
import { isTauri } from '../platform';
import type { FileService } from './types';

let instance: FileService | null = null;

async function getInstance(): Promise<FileService> {
  if (instance) return instance;

  if (isTauri()) {
    const { TauriFileService } = await import('./tauri');
    instance = new TauriFileService();
  } else {
    const { BrowserFileService } = await import('./browser');
    instance = new BrowserFileService();
  }

  return instance;
}

export const fileService = {
  async openFile(...args: Parameters<FileService['openFile']>) {
    const service = await getInstance();
    return service.openFile(...args);
  },

  async saveFile(...args: Parameters<FileService['saveFile']>) {
    const service = await getInstance();
    return service.saveFile(...args);
  },

  async readFile(...args: Parameters<FileService['readFile']>) {
    const service = await getInstance();
    return service.readFile(...args);
  },

  async readFileAsBuffer(...args: Parameters<FileService['readFileAsBuffer']>) {
    const service = await getInstance();
    return service.readFileAsBuffer(...args);
  },

  getCapabilities() {
    if (!instance) {
      return {
        nativeFilePicker: false,
        directoryPicker: false,
        multiplePicker: false,
        pathAccess: false,
      };
    }
    return instance.getCapabilities();
  },
};

export * from './types';
