// src/services/clipboard/tauri.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TauriClipboardService } from './tauri';

const mockReadText = vi.fn();
const mockWriteText = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: (...args: any[]) => mockReadText(...args),
  writeText: (...args: any[]) => mockWriteText(...args),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('TauriClipboardService', () => {
  let service: TauriClipboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TauriClipboardService();
  });

  describe('readText', () => {
    it('returns clipboard text', async () => {
      mockReadText.mockResolvedValue('copied text');

      const result = await service.readText();

      expect(result).toBe('copied text');
    });

    it('returns empty string when clipboard is empty', async () => {
      mockReadText.mockResolvedValue(null);

      const result = await service.readText();

      expect(result).toBe('');
    });

    it('returns empty string for undefined clipboard value', async () => {
      mockReadText.mockResolvedValue(undefined);

      const result = await service.readText();

      expect(result).toBe('');
    });
  });

  describe('writeText', () => {
    it('calls plugin writeText with provided string', async () => {
      mockWriteText.mockResolvedValue(undefined);

      await service.writeText('hello clipboard');

      expect(mockWriteText).toHaveBeenCalledWith('hello clipboard');
    });

    it('propagates errors from the plugin', async () => {
      mockWriteText.mockRejectedValue(new Error('clipboard locked'));

      await expect(service.writeText('text')).rejects.toThrow('clipboard locked');
    });
  });

  describe('readImage', () => {
    it('returns null when no image bytes returned', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await service.readImage();

      expect(result).toBeNull();
    });

    it('returns a PNG Blob when bytes are returned', async () => {
      mockInvoke.mockResolvedValue([137, 80, 78, 71]);

      const result = await service.readImage();

      expect(result).toBeInstanceOf(Blob);
      expect(result!.type).toBe('image/png');
    });

    it('returns null when invoke throws (not yet implemented)', async () => {
      mockInvoke.mockRejectedValue(new Error('not implemented'));

      const result = await service.readImage();

      expect(result).toBeNull();
    });
  });

  describe('getCapabilities', () => {
    it('reports text read/write as supported', () => {
      const caps = service.getCapabilities();

      expect(caps.readText).toBe(true);
      expect(caps.writeText).toBe(true);
    });

    it('reports image clipboard as not yet supported', () => {
      const caps = service.getCapabilities();

      expect(caps.readImage).toBe(false);
      expect(caps.writeImage).toBe(false);
    });
  });
});
