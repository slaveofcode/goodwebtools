// src/services/clipboard/tauri.ts
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import type { ClipboardService, ClipboardServiceCapabilities } from './types';

export class TauriClipboardService implements ClipboardService {
  async readText(): Promise<string> {
    const text = await readText();
    return text || '';
  }

  async writeText(text: string): Promise<void> {
    await writeText(text);
  }

  async readImage(): Promise<Blob | null> {
    try {
      // Tauri doesn't have built-in image clipboard support yet
      // This would need a custom Rust command
      const imageBytes: number[] | null = await invoke('clipboard_read_image');

      if (!imageBytes) return null;

      return new Blob([new Uint8Array(imageBytes)], { type: 'image/png' });
    } catch (error) {
      console.warn('Image clipboard not implemented:', error);
      return null;
    }
  }

  async writeImage(image: Blob): Promise<void> {
    try {
      const buffer = await image.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));

      await invoke('clipboard_write_image', { imageBytes: bytes });
    } catch (error) {
      throw new Error('Failed to write image to clipboard: ' + (error as Error).message);
    }
  }

  getCapabilities(): ClipboardServiceCapabilities {
    return {
      readText: true,
      writeText: true,
      readImage: false, // Not yet implemented in Rust
      writeImage: false, // Not yet implemented in Rust
    };
  }
}
