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
    try {
      const handle: RecordingHandle = await invoke('start_recording', { options });
      return handle;
    } catch (error) {
      console.warn('Native recording failed', error);
      throw error;
    }
  }

  async stopRecording(handle: RecordingHandle): Promise<Blob> {
    try {
      const videoBytes: number[] = await invoke('stop_recording', {
        handleId: handle.id,
      });
      return new Blob([new Uint8Array(videoBytes)], { type: 'video/webm' });
    } catch (error) {
      console.warn('Stop recording failed', error);
      throw error;
    }
  }

  async showRegionSelector(): Promise<Rectangle | null> {
    try {
      const bounds: Rectangle | null = await invoke('show_region_selector');
      return bounds;
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
