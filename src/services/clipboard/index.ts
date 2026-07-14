// src/services/clipboard/index.ts
import { isTauri } from '../platform';
import type { ClipboardService } from './types';

let instance: ClipboardService | null = null;

async function getInstance(): Promise<ClipboardService> {
  if (instance) return instance;

  if (isTauri()) {
    const { TauriClipboardService } = await import('./tauri');
    instance = new TauriClipboardService();
  } else {
    const { BrowserClipboardService } = await import('./browser');
    instance = new BrowserClipboardService();
  }

  return instance;
}

export const clipboardService = {
  async readText() {
    const service = await getInstance();
    return service.readText();
  },

  async writeText(text: string) {
    const service = await getInstance();
    return service.writeText(text);
  },

  async readImage() {
    const service = await getInstance();
    return service.readImage();
  },

  async writeImage(image: Blob) {
    const service = await getInstance();
    return service.writeImage(image);
  },

  getCapabilities() {
    if (!instance) {
      return {
        readText: false,
        writeText: false,
        readImage: false,
        writeImage: false,
      };
    }
    return instance.getCapabilities();
  },
};

export * from './types';
