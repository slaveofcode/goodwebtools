// src/services/asset/tauri.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TauriAssetService } from './tauri';

const mockFetch = vi.fn();
const mockExists = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
const mockRemove = vi.fn();

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: any[]) => mockFetch(...args),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppCache: 'AppCache' },
  exists: (...args: any[]) => mockExists(...args),
  readFile: (...args: any[]) => mockReadFile(...args),
  writeFile: (...args: any[]) => mockWriteFile(...args),
  mkdir: (...args: any[]) => mockMkdir(...args),
  remove: (...args: any[]) => mockRemove(...args),
}));

function makeResponse(data: ArrayBuffer, status = 200) {
  return { ok: status >= 200 && status < 300, status, arrayBuffer: () => Promise.resolve(data) };
}

describe('TauriAssetService', () => {
  let service: TauriAssetService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExists.mockResolvedValue(false);
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    service = new TauriAssetService();
  });

  describe('fetch', () => {
    it('fetches from network when no cache entry exists', async () => {
      const data = new Uint8Array([1, 2, 3]).buffer;
      mockFetch.mockResolvedValue(makeResponse(data));

      const result = await service.fetch('https://example.com/asset.bin');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/asset.bin', expect.any(Object));
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('returns cached data when cache is fresh', async () => {
      mockExists.mockResolvedValue(true);
      const meta = JSON.stringify({ timestamp: Date.now(), url: 'https://example.com/a.bin' });
      mockReadFile
        .mockResolvedValueOnce(new TextEncoder().encode(meta)) // meta file
        .mockResolvedValueOnce(new Uint8Array([9, 8, 7]));    // cache file

      const result = await service.fetch('https://example.com/a.bin');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(new Uint8Array(result)[0]).toBe(9);
    });

    it('re-fetches when cache is stale', async () => {
      mockExists.mockResolvedValue(true);
      const staleTimestamp = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
      const meta = JSON.stringify({ timestamp: staleTimestamp, url: 'https://example.com/b.bin' });
      mockReadFile.mockResolvedValue(new TextEncoder().encode(meta));

      const freshData = new Uint8Array([5, 6, 7]).buffer;
      mockFetch.mockResolvedValue(makeResponse(freshData));

      const result = await service.fetch('https://example.com/b.bin', { maxAgeMs: 7 * 24 * 60 * 60 * 1000 });

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('throws on non-OK HTTP response', async () => {
      mockFetch.mockResolvedValue(makeResponse(new ArrayBuffer(0), 404));

      await expect(service.fetch('https://example.com/missing')).rejects.toThrow('404');
    });

    it('writes data and meta to cache after network fetch', async () => {
      const data = new Uint8Array([1]).buffer;
      mockFetch.mockResolvedValue(makeResponse(data));

      await service.fetch('https://example.com/c.bin');

      expect(mockMkdir).toHaveBeenCalledOnce();
      expect(mockWriteFile).toHaveBeenCalledTimes(2); // data + meta
    });

    it('still returns data when cache write fails', async () => {
      mockWriteFile.mockRejectedValue(new Error('disk full'));
      mockFetch.mockResolvedValue(makeResponse(new Uint8Array([42]).buffer));

      const result = await service.fetch('https://example.com/d.bin');

      expect(new Uint8Array(result)[0]).toBe(42);
    });

    it('produces a deterministic cache path for the same URL', async () => {
      mockFetch.mockResolvedValue(makeResponse(new ArrayBuffer(0)));

      await service.fetch('https://example.com/stable.bin');
      await service.fetch('https://example.com/stable.bin');

      // Both calls write to the same path (first arg of writeFile is the same)
      const [path1] = mockWriteFile.mock.calls[0];
      const [path2] = mockWriteFile.mock.calls[2]; // third call = second fetch's data write
      expect(path1).toBe(path2);
    });
  });

  describe('isCached', () => {
    it('returns true when cache file exists', async () => {
      mockExists.mockResolvedValue(true);

      expect(await service.isCached('https://example.com/x')).toBe(true);
    });

    it('returns false when cache file absent', async () => {
      mockExists.mockResolvedValue(false);

      expect(await service.isCached('https://example.com/y')).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('calls remove on the cache directory', async () => {
      await service.clearCache();

      expect(mockRemove).toHaveBeenCalledWith(
        'asset-cache',
        expect.objectContaining({ recursive: true })
      );
    });

    it('does not throw when remove fails', async () => {
      mockRemove.mockRejectedValue(new Error('not found'));

      await expect(service.clearCache()).resolves.toBeUndefined();
    });
  });
});
