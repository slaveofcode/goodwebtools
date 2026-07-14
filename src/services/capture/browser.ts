// src/services/capture/browser.ts
import type {
  CaptureService,
  CaptureOptions,
  RecordOptions,
  RecordingHandle,
  Rectangle,
  CaptureServiceCapabilities,
} from './types';

export class BrowserCaptureService implements CaptureService {
  private activeRecordings = new Map<string, MediaRecorder>();

  async captureScreen(options?: CaptureOptions): Promise<Blob> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: 'screen' as any },
      audio: options?.includeAudio || false,
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;

    // Wait for video to load
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
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not create blob from canvas'));
          }
        },
        `image/${options?.format || 'png'}`,
        options?.quality
      );
    });
  }

  async captureWindow(_windowId?: string): Promise<Blob> {
    // Browser can't target specific windows, fall back to screen capture
    return this.captureScreen();
  }

  async captureRegion(_bounds: Rectangle): Promise<Blob> {
    // Browser can't capture specific region without full screen first
    throw new Error(
      'Region capture not supported in browser. Use showRegionSelector() to check support.'
    );
  }

  async startRecording(options?: RecordOptions): Promise<RecordingHandle> {
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
    // Not possible in browser
    return null;
  }

  getCapabilities(): CaptureServiceCapabilities {
    return {
      systemCapture: false,
      regionSelector: false,
      systemAudio: false,
      globalHotkeys: false,
    };
  }
}
