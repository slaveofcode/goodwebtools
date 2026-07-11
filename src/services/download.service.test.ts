import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DownloadService } from './download.service';

describe('DownloadService', () => {
  let downloadService: DownloadService;
  let mockLink: HTMLAnchorElement;

  beforeEach(() => {
    downloadService = new DownloadService();
    mockLink = document.createElement('a');
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    vi.spyOn(mockLink, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should trigger download with blob URL', async () => {
    const blob = new Blob(['test content'], { type: 'text/plain' });
    await downloadService.download(blob, 'test.txt');

    expect(mockLink.download).toBe('test.txt');
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('should clean up blob URL after download', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const blob = new Blob(['test'], { type: 'text/plain' });
    await downloadService.download(blob, 'test.txt');

    expect(revokeSpy).toHaveBeenCalled();
  });
});
