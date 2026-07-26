import { describe, it, expect, beforeEach } from 'vitest';
import { FileService } from './file.service';

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    fileService = new FileService();
  });

  it('should accept File objects', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const files = await fileService.getFiles(file);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test.txt');
  });

  it('should accept File array', async () => {
    const files = [
      new File(['test1'], 'test1.txt'),
      new File(['test2'], 'test2.txt')
    ];
    const result = await fileService.getFiles(files);
    expect(result).toHaveLength(2);
  });

  it('should accept FileList', async () => {
    // Mock FileList since DataTransfer is not available in jsdom
    const mockFileList = {
      0: new File(['test'], 'test.txt'),
      length: 1,
      item: (index: number) => index === 0 ? new File(['test'], 'test.txt') : null,
      [Symbol.iterator]: function* () {
        for (let i = 0; i < this.length; i++) {
          yield this[i];
        }
      }
    } as unknown as FileList;

    const result = await fileService.getFiles(mockFileList);
    expect(result).toHaveLength(1);
  });
});
