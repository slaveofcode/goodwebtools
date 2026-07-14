// src/services/asset/tauri.ts
import { fetch as tauriFetch } from '@tauri-apps/api/http';
import { BaseDirectory, readBinaryFile, writeBinaryFile, exists, createDir, removeFile } from '@tauri-apps/api/fs';
import type { AssetService, AssetFetchOptions } from './types';

export class TauriAssetService implements AssetService {
  private readonly DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly CACHE_DIR = 'asset-cache';

  private async getCachePath(url: string): Promise<string> {
    // Create hash of URL for filename
    const hash = Array.from(url)
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
      .toString(36);

    return `${this.CACHE_DIR}/${hash}.bin`;
  }

  private async getCacheMetaPath(url: string): Promise<string> {
    const cachePath = await this.getCachePath(url);
    return `${cachePath}.meta`;
  }

  async fetch(url: string, options?: AssetFetchOptions): Promise<ArrayBuffer> {
    const maxAgeMs = options?.maxAgeMs || this.DEFAULT_TTL_MS;
    const cachePath = await this.getCachePath(url);
    const metaPath = await this.getCacheMetaPath(url);

    // Check if cached
    try {
      if (await exists(cachePath, { dir: BaseDirectory.AppCache })) {
        // Read metadata
        const metaData = await readBinaryFile(metaPath, { dir: BaseDirectory.AppCache });
        const metaStr = new TextDecoder().decode(metaData);
        const meta = JSON.parse(metaStr);

        const ageMs = Date.now() - meta.timestamp;
        if (ageMs < maxAgeMs) {
          // Return cached
          const data = await readBinaryFile(cachePath, { dir: BaseDirectory.AppCache });
          return data.buffer;
        }
      }
    } catch (error) {
      // Cache miss or error reading cache
    }

    // Fetch fresh
    const response = await tauriFetch(url, { method: 'GET', responseType: 2 }); // 2 = Binary

    if (response.status !== 200) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const data = response.data as number[];
    const arrayBuffer = new Uint8Array(data).buffer;

    // Cache it
    try {
      // Ensure cache directory exists
      await createDir(this.CACHE_DIR, { dir: BaseDirectory.AppCache, recursive: true });

      // Write data
      await writeBinaryFile(cachePath, new Uint8Array(arrayBuffer), { dir: BaseDirectory.AppCache });

      // Write metadata
      const meta = { timestamp: Date.now(), url };
      const metaStr = JSON.stringify(meta);
      await writeBinaryFile(metaPath, new TextEncoder().encode(metaStr), { dir: BaseDirectory.AppCache });
    } catch (error) {
      console.warn('Failed to cache asset:', error);
    }

    return arrayBuffer;
  }

  async isCached(url: string): Promise<boolean> {
    const cachePath = await this.getCachePath(url);
    return await exists(cachePath, { dir: BaseDirectory.AppCache });
  }

  async clearCache(): Promise<void> {
    // Note: This is a simplified implementation
    // A full implementation would enumerate and delete all files
    try {
      // For now, just remove the cache directory
      // This would need recursive directory deletion
      console.warn('Cache clearing not fully implemented in Tauri');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
}
