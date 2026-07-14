// src/services/capture/browser.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserCaptureService } from './browser';

// Mock browser APIs
class MockMediaStream {
  getTracks() {
    return [];
  }
}

global.MediaStream = MockMediaStream as any;

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getDisplayMedia: vi.fn(),
  },
});

describe('BrowserCaptureService', () => {
  let service: BrowserCaptureService;

  beforeEach(() => {
    service = new BrowserCaptureService();
    vi.clearAllMocks();
  });

  it('captures screen using getDisplayMedia', async () => {
    const mockStream = new MediaStream();
    const mockTrack = { stop: vi.fn() };
    mockStream.getTracks = vi.fn(() => [mockTrack as any]);

    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockResolvedValue(mockStream as any);

    // Mock video element
    const mockVideo = {
      srcObject: null,
      muted: false,
      videoWidth: 1920,
      videoHeight: 1080,
      onloadedmetadata: null as any,
      play: vi.fn().mockResolvedValue(undefined),
    };

    const originalCreateElement = document.createElement;
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'video') {
        // Trigger onloadedmetadata immediately
        setTimeout(() => {
          if (mockVideo.onloadedmetadata) {
            mockVideo.onloadedmetadata();
          }
        }, 0);
        return mockVideo as any;
      }
      return originalCreateElement.call(document, tagName);
    });

    // Mock HTMLCanvasElement methods
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.toBlob = vi.fn(function(callback) {
      callback!(new Blob(['test'], { type: 'image/png' }));
    });

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as any;

    const blob = await service.captureScreen({ format: 'png' });

    expect(blob).toBeInstanceOf(Blob);
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();

    // Restore
    document.createElement = originalCreateElement;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('returns null for region selector (not supported)', async () => {
    const result = await service.showRegionSelector();
    expect(result).toBeNull();
  });

  it('returns correct capabilities', () => {
    const caps = service.getCapabilities();
    expect(caps.systemCapture).toBe(false);
    expect(caps.regionSelector).toBe(false);
    expect(caps.systemAudio).toBe(false);
    expect(caps.globalHotkeys).toBe(false);
  });

  it('starts recording using MediaRecorder', async () => {
    const mockStream = new MediaStream();
    vi.spyOn(navigator.mediaDevices, 'getDisplayMedia').mockResolvedValue(mockStream as any);

    // Mock MediaRecorder
    const mockRecorder = {
      start: vi.fn(),
      stream: mockStream,
    };
    global.MediaRecorder = vi.fn(() => mockRecorder) as any;

    const handle = await service.startRecording({ format: 'webm' });

    expect(handle).toHaveProperty('id');
    expect(handle).toHaveProperty('startTime');
    expect(mockRecorder.start).toHaveBeenCalled();
  });
});
