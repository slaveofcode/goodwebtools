// src/services/asset/index.ts
import { isTauri } from '../platform';
import type { AssetService, AssetFetchOptions } from './types';

let instance: AssetService | null = null;

async function getInstance(): Promise<AssetService> {
  if (instance) return instance;

  if (isTauri()) {
    const { TauriAssetService } = await import('./tauri');
    instance = new TauriAssetService();
  } else {
    const { BrowserAssetService } = await import('./browser');
    instance = new BrowserAssetService();
  }

  return instance;
}

export const assetCache = {
  async fetch(url: string, options?: AssetFetchOptions) {
    const service = await getInstance();
    return service.fetch(url, options);
  },

  async isCached(url: string) {
    const service = await getInstance();
    return service.isCached(url);
  },

  async clearCache() {
    const service = await getInstance();
    return service.clearCache();
  },
};

export * from './types';
