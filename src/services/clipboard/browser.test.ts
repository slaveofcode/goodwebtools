// src/services/clipboard/browser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserClipboardService } from './browser';

describe('BrowserClipboardService', () => {
  let service: BrowserClipboardService;

  beforeEach(() => {
    service = new BrowserClipboardService();
    vi.clearAllMocks();
  });

  it('writes text using Clipboard API', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        writeText: mockWriteText,
      },
    });

    await service.writeText('hello world');

    expect(mockWriteText).toHaveBeenCalledWith('hello world');
  });

  it('reads text using Clipboard API', async () => {
    const mockReadText = vi.fn().mockResolvedValue('clipboard content');
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        readText: mockReadText,
      },
    });

    const text = await service.readText();

    expect(text).toBe('clipboard content');
    expect(mockReadText).toHaveBeenCalled();
  });

  it('writes image using Clipboard API', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    global.ClipboardItem = vi.fn((items: any) => items) as any;

    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        write: mockWrite,
      },
    });

    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    await service.writeImage(mockBlob);

    expect(mockWrite).toHaveBeenCalled();
    expect(global.ClipboardItem).toHaveBeenCalled();
  });

  it('returns null when reading image fails', async () => {
    const mockRead = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        read: mockRead,
      },
    });

    const image = await service.readImage();

    expect(image).toBeNull();
  });

  it('returns correct capabilities', () => {
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        readText: vi.fn(),
        writeText: vi.fn(),
        read: vi.fn(),
        write: vi.fn(),
      },
    });

    const caps = service.getCapabilities();

    expect(caps.readText).toBe(true);
    expect(caps.writeText).toBe(true);
    expect(caps.readImage).toBe(true);
    expect(caps.writeImage).toBe(true);
  });
});
