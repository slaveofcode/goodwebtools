// src/services/capture/tauri.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TauriCaptureService } from './tauri';
import type { DisplayInfo } from './types';

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: any[]) => mockListen(...args),
}));

// Capture commands now return raw bytes over IPC (tauri::ipc::Response),
// which arrive as an ArrayBuffer on the JS side — not a number[].
const buf = (bytes: number[]): ArrayBuffer => new Uint8Array(bytes).buffer;

describe('TauriCaptureService', () => {
  let service: TauriCaptureService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TauriCaptureService();
  });

  describe('listDisplays', () => {
    it('calls invoke with correct command name', async () => {
      const mockDisplays: DisplayInfo[] = [
        { id: 1, name: 'Display 1', width: 1920, height: 1080, isMain: true },
        { id: 2, name: 'Display 2', width: 2560, height: 1440, isMain: false },
      ];

      mockInvoke.mockResolvedValue(mockDisplays);

      const result = await service.listDisplays();

      expect(mockInvoke).toHaveBeenCalledWith('list_displays');
      expect(result).toEqual(mockDisplays);
    });

    it('handles negative display IDs correctly', async () => {
      const mockDisplays: DisplayInfo[] = [
        { id: -1, name: 'Display 1', width: 1920, height: 1080, isMain: true },
        { id: -2, name: 'Display 2', width: 2560, height: 1440, isMain: false },
      ];

      mockInvoke.mockResolvedValue(mockDisplays);

      const result = await service.listDisplays();

      expect(result[0].id).toBe(-1);
      expect(result[1].id).toBe(-2);
      expect(typeof result[0].id).toBe('number');
    });
  });

  describe('showRegionSelector', () => {
    it('passes displayId in correct structure for Tauri', async () => {
      mockInvoke.mockResolvedValue(undefined);
      mockListen.mockResolvedValue(() => {});

      const displayId = 2;

      // Don't await - it will hang waiting for event
      const promise = service.showRegionSelector(displayId);

      // Give it time to call invoke
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockInvoke).toHaveBeenCalledWith('show_region_selector', {
        options: { displayId: 2 }
      });
    });

    it('handles undefined displayId correctly', async () => {
      mockInvoke.mockResolvedValue(undefined);
      mockListen.mockResolvedValue(() => {});

      // Don't await
      const promise = service.showRegionSelector(undefined);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockInvoke).toHaveBeenCalledWith('show_region_selector', {
        options: undefined
      });
    });

    it('handles negative displayId correctly', async () => {
      mockInvoke.mockResolvedValue(undefined);
      mockListen.mockResolvedValue(() => {});

      // Don't await
      const promise = service.showRegionSelector(-2);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockInvoke).toHaveBeenCalledWith('show_region_selector', {
        options: { displayId: -2 }
      });
    });
  });

  describe('captureScreen', () => {
    it('passes displayId in options', async () => {
      mockInvoke.mockResolvedValue(buf([1, 2, 3]));

      const result = await service.captureScreen({
        format: 'png',
        displayId: 2,
      });

      expect(mockInvoke).toHaveBeenCalledWith('capture_screen', {
        options: {
          format: 'png',
          displayId: 2,
        },
      });

      expect(result).toBeInstanceOf(Blob);
    });

    it('handles negative displayId in captureScreen', async () => {
      mockInvoke.mockResolvedValue(buf([1, 2, 3]));

      await service.captureScreen({
        format: 'png',
        displayId: -2,
      });

      expect(mockInvoke).toHaveBeenCalledWith('capture_screen', {
        options: expect.objectContaining({
          displayId: -2,
        }),
      });
    });
  });

  describe('captureRegion', () => {
    it('calls invoke with bounds only when no displayId', async () => {
      mockInvoke.mockResolvedValue(buf([1, 2, 3, 4]));

      const bounds = { x: 10, y: 20, width: 300, height: 200 };
      const result = await service.captureRegion(bounds);

      expect(mockInvoke).toHaveBeenCalledWith('capture_region', { bounds });
      expect(result).toBeInstanceOf(Blob);
    });

    it('extracts displayId from bounds and passes separately', async () => {
      mockInvoke.mockResolvedValue(buf([1, 2, 3, 4]));

      const bounds = { x: 0, y: 0, width: 2560, height: 1440, displayId: 2 };
      await service.captureRegion(bounds);

      expect(mockInvoke).toHaveBeenCalledWith('capture_region', {
        bounds: { x: 0, y: 0, width: 2560, height: 1440 },
        displayId: 2,
      });
    });

    it('does not pass displayId key inside bounds object', async () => {
      mockInvoke.mockResolvedValue(buf([]));

      await service.captureRegion({ x: 0, y: 0, width: 100, height: 100, displayId: 3 });

      const call = mockInvoke.mock.calls[0];
      expect(call[1].bounds).not.toHaveProperty('displayId');
    });

    it('handles negative displayId (macOS CoreGraphics IDs)', async () => {
      mockInvoke.mockResolvedValue(buf([1, 2]));

      await service.captureRegion({ x: 0, y: 0, width: 100, height: 100, displayId: -2 });

      expect(mockInvoke).toHaveBeenCalledWith('capture_region', {
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        displayId: -2,
      });
    });

    it('returns a PNG blob', async () => {
      mockInvoke.mockResolvedValue(buf([137, 80, 78, 71]));

      const result = await service.captureRegion({ x: 0, y: 0, width: 50, height: 50 });

      expect(result.type).toBe('image/png');
    });

    it('propagates invoke errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Screen recording permission denied'));

      await expect(
        service.captureRegion({ x: 0, y: 0, width: 100, height: 100 })
      ).rejects.toThrow('Screen recording permission denied');
    });
  });

  describe('getCapabilities', () => {
    it('returns Tauri-specific capabilities', () => {
      const caps = service.getCapabilities();

      expect(caps.systemCapture).toBe(true);
      expect(caps.regionSelector).toBe(true);
      expect(caps.globalHotkeys).toBe(true);
    });
  });
});
