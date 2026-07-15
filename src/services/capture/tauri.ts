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
  private activeRecordings = new Map<string, MediaRecorder>();

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
    // Fall back to browser MediaRecorder API until native recording is implemented
    console.log('[Tauri] Using browser MediaRecorder for recording (native not yet implemented)');

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: 'screen' as any },
      audio: options?.includeAudio || false,
    });

    const mimeType = options?.format === 'mp4' ? 'video/mp4' : 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: options?.videoBitrate,
      audioBitsPerSecond: options?.audioBitrate,
    });

    const handle: RecordingHandle = {
      id: `rec_${Date.now()}`,
      startTime: Date.now(),
    };

    this.activeRecordings.set(handle.id, recorder);
    recorder.start();

    return handle;
  }

  async stopRecording(handle: RecordingHandle): Promise<Blob> {
    // Use browser MediaRecorder
    const recorder = this.activeRecordings.get(handle.id);

    if (!recorder) {
      throw new Error(`Recording ${handle.id} not found`);
    }

    return new Promise((resolve, reject) => {
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        this.activeRecordings.delete(handle.id);

        // Stop all tracks
        recorder.stream.getTracks().forEach((t) => t.stop());

        resolve(blob);
      };

      recorder.onerror = (error) => {
        this.activeRecordings.delete(handle.id);
        reject(error);
      };

      recorder.stop();
    });
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
