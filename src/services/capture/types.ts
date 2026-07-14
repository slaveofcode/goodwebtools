// src/services/capture/types.ts
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureOptions {
  format?: 'png' | 'jpeg';
  quality?: number;
  includeAudio?: boolean;
  systemAudio?: boolean;
}

export interface RecordOptions {
  format?: 'webm' | 'mp4';
  videoBitrate?: number;
  audioBitrate?: number;
  includeAudio?: boolean;
  systemAudio?: boolean;
  fps?: number;
}

export interface RecordingHandle {
  id: string;
  startTime: number;
}

export interface CaptureServiceCapabilities {
  systemCapture: boolean;
  regionSelector: boolean;
  systemAudio: boolean;
  globalHotkeys: boolean;
}

export interface CaptureService {
  captureScreen(options?: CaptureOptions): Promise<Blob>;
  captureWindow(windowId?: string): Promise<Blob>;
  captureRegion(bounds: Rectangle): Promise<Blob>;
  startRecording(options?: RecordOptions): Promise<RecordingHandle>;
  stopRecording(handle: RecordingHandle): Promise<Blob>;
  showRegionSelector(): Promise<Rectangle | null>;
  getCapabilities(): CaptureServiceCapabilities;
}
