// src/services/capture/types.ts
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  isMain: boolean;
}

export interface CaptureOptions {
  format?: 'png' | 'jpeg';
  quality?: number;
  includeAudio?: boolean;
  systemAudio?: boolean;
  displayId?: number;
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
  listDisplays(): Promise<DisplayInfo[]>;
  captureWindow(windowId?: string): Promise<Blob>;
  captureRegion(bounds: Rectangle): Promise<Blob>;
  startRecording(options?: RecordOptions): Promise<RecordingHandle>;
  stopRecording(handle: RecordingHandle): Promise<Blob>;
  showRegionSelector(): Promise<Rectangle | null>;
  getCapabilities(): CaptureServiceCapabilities;
}
