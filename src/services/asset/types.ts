// src/services/asset/types.ts

export interface AssetFetchOptions {
  integrity?: string;
  maxAgeMs?: number;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
  showProgress?: boolean;
}

export interface AssetService {
  fetch(url: string, options?: AssetFetchOptions): Promise<ArrayBuffer>;
  isCached(url: string): Promise<boolean>;
  clearCache(): Promise<void>;
}
