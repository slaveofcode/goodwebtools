// src/services/asset/browser.ts
import type { AssetService, AssetFetchOptions } from './types';

export class BrowserAssetService implements AssetService {
  private readonly DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly PROGRESS_THRESHOLD_BYTES = 1_024_000; // 1 MB
  private cache = new Map<string, { data: ArrayBuffer; timestamp: number }>();

  async fetch(url: string, options?: AssetFetchOptions): Promise<ArrayBuffer> {
    const maxAgeMs = options?.maxAgeMs || this.DEFAULT_TTL_MS;

    // Check in-memory cache
    const cached = this.cache.get(url);
    if (cached) {
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs < maxAgeMs) {
        return cached.data;
      }
      // Expired - remove from cache
      this.cache.delete(url);
    }

    // Fetch fresh
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const totalBytes = parseInt(response.headers.get('content-length') || '0');
    const shouldShowProgress = options?.showProgress ?? (totalBytes > this.PROGRESS_THRESHOLD_BYTES);

    let data: ArrayBuffer;

    if (!shouldShowProgress || !response.body) {
      data = await response.arrayBuffer();
    } else {
      // Stream with progress
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loadedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loadedBytes += value.length;
        options?.onProgress?.(loadedBytes, totalBytes);
      }

      // Concatenate chunks
      const allData = new Uint8Array(loadedBytes);
      let offsetBytes = 0;
      for (const chunk of chunks) {
        allData.set(chunk, offsetBytes);
        offsetBytes += chunk.length;
      }
      data = allData.buffer;
    }

    // Cache it
    this.cache.set(url, { data, timestamp: Date.now() });
    return data;
  }

  async isCached(url: string): Promise<boolean> {
    return this.cache.has(url);
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
  }
}
