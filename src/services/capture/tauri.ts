// src/services/capture/tauri.ts
import { invoke } from '@tauri-apps/api/core';
import type {
  CaptureService,
  CaptureOptions,
  RecordOptions,
  RecordingHandle,
  Rectangle,
  CaptureServiceCapabilities,
} from './types';

export class TauriCaptureService implements CaptureService {
  async captureScreen(options?: CaptureOptions): Promise<Blob> {
    try {
      const imageBytes: number[] = await invoke('capture_screen', { options });
      return new Blob([new Uint8Array(imageBytes)], {
        type: `image/${options?.format || 'png'}`,
      });
    } catch (error) {
      // Fallback to browser API if native fails or not implemented yet
      console.warn('Native capture failed, falling back to browser API', error);
      return this.browserFallback(options);
    }
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

  private async browserFallback(options?: CaptureOptions): Promise<Blob> {
    // Fallback to browser MediaDevices API
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: 'screen' as any },
      audio: options?.includeAudio || false,
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(() => resolve());
      };
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('Could not get canvas context');
    }

    ctx.drawImage(video, 0, 0);
    stream.getTracks().forEach((t) => t.stop());

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not create blob'));
        },
        `image/${options?.format || 'png'}`,
        options?.quality
      );
    });
  }
}
