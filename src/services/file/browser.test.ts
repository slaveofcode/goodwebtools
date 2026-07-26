// src/services/file/browser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserFileService } from './browser';

describe('BrowserFileService', () => {
  let service: BrowserFileService;

  beforeEach(() => {
    service = new BrowserFileService();
    vi.clearAllMocks();
  });

  it('opens file using legacy input method when showOpenFilePicker unavailable', async () => {
    // Ensure modern API is not available
    (window as any).showOpenFilePicker = undefined;

    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    // Mock document.createElement for input
    const mockInput = {
      type: '',
      multiple: false,
      accept: '',
      files: [mockFile],
      onchange: null as any,
      oncancel: null as any,
      click: vi.fn(),
    };

    const originalCreateElement = document.createElement;
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'input') {
        // Trigger onchange immediately
        setTimeout(() => {
          if (mockInput.onchange) {
            mockInput.onchange();
          }
        }, 0);
        return mockInput as any;
      }
      return originalCreateElement.call(document, tagName);
    });

    const files = await service.openFile({ accept: '.txt' });

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test.txt');
    expect(mockInput.click).toHaveBeenCalled();

    // Restore
    document.createElement = originalCreateElement;
  });

  it('saves file using legacy download method when showSaveFilePicker unavailable', async () => {
    // Ensure modern API is not available
    (window as any).showSaveFilePicker = undefined;

    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };

    const originalCreateElement = document.createElement;
    const originalAppendChild = document.body.appendChild;
    const originalRemoveChild = document.body.removeChild;

    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'a') {
        return mockLink as any;
      }
      return originalCreateElement.call(document, tagName);
    });

    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    const result = await service.saveFile('test content', { suggestedName: 'output.txt' });

    expect(result).toBe(true);
    expect(mockLink.download).toBe('output.txt');
    expect(mockLink.click).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    // Restore
    document.createElement = originalCreateElement;
    document.body.appendChild = originalAppendChild;
    document.body.removeChild = originalRemoveChild;
  });

  it('reads file as text', async () => {
    const mockFile = new File(['hello world'], 'test.txt', { type: 'text/plain' });

    const content = await service.readFile(mockFile);

    expect(content).toBe('hello world');
  });

  it('reads file as buffer', async () => {
    const mockFile = new File([new Uint8Array([1, 2, 3])], 'test.bin', {
      type: 'application/octet-stream',
    });

    const buffer = await service.readFileAsBuffer(mockFile);

    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(buffer)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('returns correct capabilities', () => {
    const caps = service.getCapabilities();

    expect(caps.multiplePicker).toBe(true);
    expect(caps.pathAccess).toBe(false); // Browser never has path access
  });
});
