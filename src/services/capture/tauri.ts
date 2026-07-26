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
    // Command returns raw bytes (tauri::ipc::Response) → ArrayBuffer, not number[].
    const imageBytes = await invoke<ArrayBuffer>('capture_screen', { options });
    return new Blob([imageBytes], {
      type: `image/${options?.format || 'png'}`,
    });
  }

  async listDisplays(): Promise<DisplayInfo[]> {
    return await invoke('list_displays');
  }

  async captureWindow(windowId?: string): Promise<Blob> {
    try {
      const imageBytes = await invoke<ArrayBuffer>('capture_window', { windowId });
      return new Blob([imageBytes], { type: 'image/png' });
    } catch (error) {
      console.warn('Native window capture failed', error);
      throw error;
    }
  }

  async captureRegion(bounds: Rectangle): Promise<Blob> {
    try {
      console.log('[TauriCaptureService] captureRegion called with bounds:', bounds);

      // Extract displayId if present
      const { displayId, ...rect } = bounds;

      const params = displayId !== undefined
        ? { bounds: rect, displayId }
        : { bounds: rect };

      console.log('[TauriCaptureService] Calling capture_region with params:', params);

      const imageBytes = await invoke<ArrayBuffer>('capture_region', params);
      return new Blob([imageBytes], { type: 'image/png' });
    } catch (error) {
      console.warn('Native region capture failed', error);
      throw error;
    }
  }

  async startRecording(options?: RecordOptions): Promise<RecordingHandle> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      console.log('[TauriCaptureService] startRecording called with options:', options);

      const handle = await invoke<RecordingHandle>('start_recording', {
        options: {
          format: options?.format,
          fps: options?.fps,
          displayId: options?.displayId,
          bounds: options?.bounds,
          // Without these the Rust side never starts the audio recorder,
          // so recordings came out silent.
          includeAudio: options?.includeAudio,
          systemAudio: options?.systemAudio,
        },
      });

      console.log('[TauriCaptureService] Recording started:', handle);
      return handle;
    } catch (error) {
      console.error('[TauriCaptureService] Start recording failed:', error);
      throw error;
    }
  }

  async stopRecording(handle: RecordingHandle): Promise<Blob> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      console.log('[TauriCaptureService] stopRecording called with handle:', handle);

      // This will return Vec<u8> from Rust
      const videoData = await invoke<number[]>('stop_recording', {
        handleId: handle.id,
      });

      console.log('[TauriCaptureService] Recording stopped, data length:', videoData.length);

      // Convert to Blob
      const blob = new Blob([new Uint8Array(videoData)], { type: 'video/webm' });
      return blob;
    } catch (error) {
      console.error('[TauriCaptureService] Stop recording failed:', error);
      throw error;
    }
  }

  async showRegionSelector(displayId?: number): Promise<Rectangle | null> {
    try {
      const { listen } = await import('@tauri-apps/api/event');

      console.log('[TauriCaptureService] showRegionSelector called with displayId:', displayId);
      console.log('[TauriCaptureService] Invoking with params:', { options: { displayId } });

      // Show the overlay on the specified display
      // Wrap in options object to match Rust struct
      await invoke('show_region_selector', {
        options: displayId !== undefined ? { displayId } : undefined
      });

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
