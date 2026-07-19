// src/services/download/tauri.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TauriDownloadService } from './tauri';

const mockSave = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (...args: any[]) => mockSave(...args),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: (...args: any[]) => mockWriteFile(...args),
}));

// fflate stub: zip immediately resolves with the first entry bytes concatenated
vi.mock('fflate', () => ({
  zip: (entries: Record<string, Uint8Array>, _opts: any, cb: (err: null, data: Uint8Array) => void) => {
    const total = Object.values(entries).reduce((sum, b) => sum + b.length, 0);
    cb(null, new Uint8Array(total));
  },
}));

describe('TauriDownloadService', () => {
  let service: TauriDownloadService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    service = new TauriDownloadService();
  });

  describe('download', () => {
    it('opens save dialog with the suggested filename', async () => {
      mockSave.mockResolvedValue('/home/user/report.pdf');

      await service.download(new Blob(['data']), 'report.pdf');

      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPath: 'report.pdf' })
      );
    });

    it('writes blob bytes to the chosen path', async () => {
      mockSave.mockResolvedValue('/tmp/out.png');
      const blob = new Blob([new Uint8Array([1, 2, 3])]);

      await service.download(blob, 'out.png');

      expect(mockWriteFile).toHaveBeenCalledWith('/tmp/out.png', expect.any(Uint8Array));
    });

    it('does nothing when user cancels the save dialog', async () => {
      mockSave.mockResolvedValue(null);

      await service.download(new Blob(['data']), 'file.txt');

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('propagates write errors', async () => {
      mockSave.mockResolvedValue('/tmp/out.txt');
      mockWriteFile.mockRejectedValue(new Error('disk full'));

      await expect(service.download(new Blob(['x']), 'out.txt')).rejects.toThrow('disk full');
    });
  });

  describe('downloadZip', () => {
    it('zips multiple files and triggers single save dialog', async () => {
      mockSave.mockResolvedValue('/tmp/archive.zip');

      await service.downloadZip(
        [
          { blob: new Blob(['a']), filename: 'a.txt' },
          { blob: new Blob(['b']), filename: 'b.txt' },
        ],
        'archive.zip'
      );

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('passes zip filename to save dialog', async () => {
      mockSave.mockResolvedValue('/tmp/bundle.zip');

      await service.downloadZip([{ blob: new Blob(['x']), filename: 'x.txt' }], 'bundle.zip');

      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPath: 'bundle.zip' })
      );
    });

    it('does not write file when user cancels zip dialog', async () => {
      mockSave.mockResolvedValue(null);

      await service.downloadZip([{ blob: new Blob(['x']), filename: 'x.txt' }], 'out.zip');

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('getCapabilities', () => {
    it('reports native save dialog and zip support', () => {
      const caps = service.getCapabilities();

      expect(caps.nativeSaveDialog).toBe(true);
      expect(caps.zipSupport).toBe(true);
    });
  });
});
