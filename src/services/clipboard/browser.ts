// src/services/clipboard/browser.ts
import type { ClipboardService, ClipboardServiceCapabilities } from './types';

export class BrowserClipboardService implements ClipboardService {
  async readText(): Promise<string> {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      throw new Error('Clipboard API not available');
    }

    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      // Permission denied or not supported
      throw new Error('Failed to read from clipboard: ' + (error as Error).message);
    }
  }

  async writeText(text: string): Promise<void> {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      // Fallback for older browsers
      return this.writeTextLegacy(text);
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      // Fallback if Clipboard API fails
      return this.writeTextLegacy(text);
    }
  }

  private async writeTextLegacy(text: string): Promise<void> {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async readImage(): Promise<Blob | null> {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      return null;
    }

    try {
      const items = await navigator.clipboard.read();

      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            return await item.getType(type);
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to read image from clipboard:', error);
      return null;
    }
  }

  async writeImage(image: Blob): Promise<void> {
    if (!navigator.clipboard || !navigator.clipboard.write) {
      throw new Error('Clipboard API for images not available');
    }

    try {
      const item = new ClipboardItem({
        [image.type || 'image/png']: image,
      });

      await navigator.clipboard.write([item]);
    } catch (error) {
      throw new Error('Failed to write image to clipboard: ' + (error as Error).message);
    }
  }

  getCapabilities(): ClipboardServiceCapabilities {
    const hasClipboardAPI = !!navigator.clipboard;

    return {
      readText: hasClipboardAPI && !!navigator.clipboard.readText,
      writeText: hasClipboardAPI && !!navigator.clipboard.writeText,
      readImage: hasClipboardAPI && !!navigator.clipboard.read,
      writeImage: hasClipboardAPI && !!navigator.clipboard.write,
    };
  }
}
