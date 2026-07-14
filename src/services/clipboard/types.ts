// src/services/clipboard/types.ts

export interface ClipboardService {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
  readImage(): Promise<Blob | null>;
  writeImage(image: Blob): Promise<void>;
  getCapabilities(): ClipboardServiceCapabilities;
}

export interface ClipboardServiceCapabilities {
  readText: boolean;
  writeText: boolean;
  readImage: boolean;
  writeImage: boolean;
}
