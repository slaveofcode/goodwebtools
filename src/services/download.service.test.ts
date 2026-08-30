import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DownloadService } from './download.service';

describe('DownloadService', () => {
  let downloadService: DownloadService;
  let mockLink: HTMLAnchorElement;

  beforeEach(() => {
    // jsdom does not implement the blob-URL APIs — stub them.
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();

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

  it('appends the link to the document before clicking (mobile/Firefox need it in the DOM)', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const blob = new Blob(['test content'], { type: 'text/plain' });
    await downloadService.download(blob, 'test.txt');

    expect(appendSpy).toHaveBeenCalledWith(mockLink);
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('should clean up blob URL after download', async () => {
    // Revocation is deferred via setTimeout — advance timers to trigger it.
    vi.useFakeTimers();
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const blob = new Blob(['test'], { type: 'text/plain' });

    await downloadService.download(blob, 'test.txt');
    vi.runAllTimers();

    expect(revokeSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
