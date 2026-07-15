// src/services/capture/index.ts
import { isTauri } from '@/services/platform';
import type { CaptureService } from './types';

let instance: CaptureService | null = null;

async function getInstance(): Promise<CaptureService> {
  if (instance) return instance;

  if (isTauri()) {
    const { TauriCaptureService } = await import('./tauri');
    instance = new TauriCaptureService();
  } else {
    const { BrowserCaptureService } = await import('./browser');
    instance = new BrowserCaptureService();
  }

  return instance;
}

// Synchronous export for convenience (loads lazily)
export const captureService = {
  async captureScreen(options) {
    const service = await getInstance();
    return service.captureScreen(options);
  },
  async listDisplays() {
    const service = await getInstance();
    return service.listDisplays();
  },
  async captureWindow(windowId) {
    const service = await getInstance();
    return service.captureWindow(windowId);
  },
  async captureRegion(bounds) {
    const service = await getInstance();
    return service.captureRegion(bounds);
  },
  async startRecording(options) {
    const service = await getInstance();
    return service.startRecording(options);
  },
  async stopRecording(handle) {
    const service = await getInstance();
    return service.stopRecording(handle);
  },
  async showRegionSelector() {
    const service = await getInstance();
    return service.showRegionSelector();
  },
  getCapabilities() {
    // This needs to be sync, so we'll handle it specially
    if (isTauri()) {
      return {
        systemCapture: true,
        regionSelector: true,
        systemAudio: true,
        globalHotkeys: true,
      };
    } else {
      return {
        systemCapture: false,
        regionSelector: false,
        systemAudio: false,
        globalHotkeys: false,
      };
    }
  },
} as CaptureService;

export type {
  CaptureService,
  CaptureOptions,
  RecordOptions,
  RecordingHandle,
  Rectangle,
  CaptureServiceCapabilities,
  DisplayInfo,
} from './types';
