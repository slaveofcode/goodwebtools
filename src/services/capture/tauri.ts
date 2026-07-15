// src/services/capture/tauri.ts
import { invoke } from '@tauri-apps/api/core';
import type {
  CaptureService,
  CaptureOptions,
  RecordOptions,
  RecordingHandle,
  Rectangle,
  CaptureServiceCapabilities,
  DisplayInfo,
} from './types';

export class TauriCaptureService implements CaptureService {
  async captureScreen(options?: CaptureOptions): Promise<Blob> {
    const imageBytes: number[] = await invoke('capture_screen', { options });
    return new Blob([new Uint8Array(imageBytes)], {
      type: `image/${options?.format || 'png'}`,
    });
  }

  async listDisplays(): Promise<DisplayInfo[]> {
    return await invoke('list_displays');
  }

  async captureWindow(windowId?: string): Promise<Blob> {
    try {
      const imageBytes: number[] = await invoke('capture_window', { windowId });
      return new Blob([new Uint8Array(imageBytes)], { type: 'image/png' });
    } catch (error) {
      console.warn('Native window capture failed', error);
      throw error;
    }
  }

  async captureRegion(bounds: Rectangle): Promise<Blob> {
    try {
      const imageBytes: number[] = await invoke('capture_region', { bounds });
      return new Blob([new Uint8Array(imageBytes)], { type: 'image/png' });
    } catch (error) {
      console.warn('Native region capture failed', error);
      throw error;
    }
  }

  async startRecording(options?: RecordOptions): Promise<RecordingHandle> {
    // Native recording not yet implemented
    // WebView doesn't support getDisplayMedia like browsers do
    throw new Error(
      'Screen recording not yet available in desktop app. ' +
      'Use the web version at goodwebtools.com for now, or wait for native recording implementation.'
    );
  }

  async stopRecording(handle: RecordingHandle): Promise<Blob> {
    throw new Error('Screen recording not yet implemented in desktop app');
  }

  async showRegionSelector(): Promise<Rectangle | null> {
    try {
      const { listen } = await import('@tauri-apps/api/event');

      // Show the overlay
      await invoke('show_region_selector');

      // Wait for the region selection event
      return new Promise((resolve) => {
        const unlisten = listen<Rectangle>('region-selected', (event) => {
          unlisten.then(fn => fn());
          resolve(event.payload);
        });

        // Also listen for overlay close without selection (ESC pressed)
        const unlistenClose = listen('region-selector-closed', () => {
          unlistenClose.then(fn => fn());
          unlisten.then(fn => fn());
          resolve(null);
        });
      });
    } catch (error) {
      console.warn('Region selector failed', error);
      return null;
    }
  }

  getCapabilities(): CaptureServiceCapabilities {
    const platform = navigator.platform.toLowerCase();

    return {
      systemCapture: true,
      regionSelector: !platform.includes('linux'), // Linux WIP
      systemAudio: true,
      globalHotkeys: true,
    };
  }

}
