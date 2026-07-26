// src/services/file/tauri.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TauriFileService } from './tauri';

const mockOpen = vi.fn();
const mockSave = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: any[]) => mockOpen(...args),
  save: (...args: any[]) => mockSave(...args),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: (...args: any[]) => mockReadFile(...args),
  writeFile: (...args: any[]) => mockWriteFile(...args),
}));

describe('TauriFileService', () => {
  let service: TauriFileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TauriFileService();
  });

  describe('openFile', () => {
    it('returns empty array when user cancels', async () => {
      mockOpen.mockResolvedValue(null);

      const result = await service.openFile();

      expect(result).toEqual([]);
    });

    it('returns a single File when one path is selected', async () => {
      mockOpen.mockResolvedValue('/home/user/doc.txt');
      mockReadFile.mockResolvedValue(new Uint8Array([104, 101, 108, 108, 111]));

      const result = await service.openFile({ accept: '.txt' });

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(File);
      expect(result[0].name).toBe('doc.txt');
    });

    it('returns multiple Files when multiple paths selected', async () => {
      mockOpen.mockResolvedValue(['/a/foo.png', '/b/bar.png']);
      mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const result = await service.openFile({ multiple: true, accept: '.png' });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('foo.png');
      expect(result[1].name).toBe('bar.png');
    });

    it('passes multiple and directory flags to plugin', async () => {
      mockOpen.mockResolvedValue(null);

      await service.openFile({ multiple: true, directory: true });

      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({ multiple: true, directory: true })
      );
    });

    it('converts .ext accept to plugin filter format', async () => {
      mockOpen.mockResolvedValue(null);

      await service.openFile({ accept: '.pdf' });

      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: 'Files', extensions: ['pdf'] }],
        })
      );
    });

    it('converts MIME type accept to extension filter', async () => {
      mockOpen.mockResolvedValue(null);

      await service.openFile({ accept: 'image/png' });

      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: 'Files', extensions: ['png'] }],
        })
      );
    });

    it('guesses correct MIME type for known extensions', async () => {
      mockOpen.mockResolvedValue('/path/to/image.jpg');
      mockReadFile.mockResolvedValue(new Uint8Array([]));

      const [file] = await service.openFile();

      expect(file.type).toBe('image/jpeg');
    });
  });

  describe('saveFile', () => {
    it('returns false when user cancels', async () => {
      mockSave.mockResolvedValue(null);

      const result = await service.saveFile(new Blob(['data']));

      expect(result).toBe(false);
    });

    it('writes Blob data and returns true', async () => {
      mockSave.mockResolvedValue('/home/user/out.png');
      mockWriteFile.mockResolvedValue(undefined);

      const result = await service.saveFile(new Blob(['img'], { type: 'image/png' }), {
        suggestedName: 'out.png',
      });

      expect(result).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith('/home/user/out.png', expect.any(Uint8Array));
    });

    it('encodes string data as UTF-8 bytes', async () => {
      mockSave.mockResolvedValue('/tmp/out.txt');
      mockWriteFile.mockResolvedValue(undefined);

      await service.saveFile('hello world');

      const [, written] = mockWriteFile.mock.calls[0];
      expect(new TextDecoder().decode(written)).toBe('hello world');
    });

    it('passes suggestedName as defaultPath to save dialog', async () => {
      mockSave.mockResolvedValue(null);

      await service.saveFile(new Blob(), { suggestedName: 'export.json' });

      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPath: 'export.json' })
      );
    });
  });

  describe('getCapabilities', () => {
    it('reports native picker and path access', () => {
      const caps = service.getCapabilities();

      expect(caps.nativeFilePicker).toBe(true);
      expect(caps.directoryPicker).toBe(true);
      expect(caps.multiplePicker).toBe(true);
      expect(caps.pathAccess).toBe(true);
    });
  });
});
