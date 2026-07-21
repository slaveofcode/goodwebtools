// src/services/asset/tauri.ts
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { BaseDirectory, readFile, writeFile, exists, mkdir, remove } from '@tauri-apps/plugin-fs';
import type { AssetService, AssetFetchOptions } from './types';

export class TauriAssetService implements AssetService {
  private readonly DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly CACHE_DIR = 'asset-cache';

  private getCachePath(url: string): string {
    const hash = Array.from(url)
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
      .toString(36);
    return `${this.CACHE_DIR}/${hash}.bin`;
  }

  private getCacheMetaPath(url: string): string {
    return `${this.getCachePath(url)}.meta`;
  }

  async fetch(url: string, options?: AssetFetchOptions): Promise<ArrayBuffer> {
    const maxAgeMs = options?.maxAgeMs || this.DEFAULT_TTL_MS;
    const cachePath = this.getCachePath(url);
    const metaPath = this.getCacheMetaPath(url);

    // Check if cached
    try {
      if (await exists(cachePath, { baseDir: BaseDirectory.AppCache })) {
        const metaData = await readFile(metaPath, { baseDir: BaseDirectory.AppCache });
        const meta = JSON.parse(new TextDecoder().decode(metaData));

        if (Date.now() - meta.timestamp < maxAgeMs) {
          const data = await readFile(cachePath, { baseDir: BaseDirectory.AppCache });
          return data.buffer;
        }
      }
    } catch {
      // Cache miss — fall through to network fetch
    }

    // Fetch fresh
    const response = await tauriFetch(url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Cache it
    try {
      await mkdir(this.CACHE_DIR, { baseDir: BaseDirectory.AppCache, recursive: true });
      await writeFile(cachePath, new Uint8Array(arrayBuffer), { baseDir: BaseDirectory.AppCache });
      const meta = { timestamp: Date.now(), url };
      await writeFile(metaPath, new TextEncoder().encode(JSON.stringify(meta)), { baseDir: BaseDirectory.AppCache });
    } catch (err) {
      console.warn('Failed to cache asset:', err);
    }

    return arrayBuffer;
  }

  async isCached(url: string): Promise<boolean> {
    const cachePath = this.getCachePath(url);
    return exists(cachePath, { baseDir: BaseDirectory.AppCache });
  }

  async clearCache(): Promise<void> {
    try {
      await remove(this.CACHE_DIR, { baseDir: BaseDirectory.AppCache, recursive: true });
    } catch (err) {
      console.warn('Failed to clear cache:', err);
    }
  }
}
