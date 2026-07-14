// src/services/file/tauri.ts
import { open, save } from '@tauri-apps/api/dialog';
import { readTextFile, readBinaryFile, writeTextFile, writeBinaryFile } from '@tauri-apps/api/fs';
import type {
  FileService,
  FilePickerOptions,
  SaveFileOptions,
  FileServiceCapabilities,
} from './types';

export class TauriFileService implements FileService {
  async openFile(options?: FilePickerOptions): Promise<File[]> {
    const filters = this.parseAcceptToFilters(options?.accept);

    const selected = await open({
      multiple: options?.multiple || false,
      directory: options?.directory || false,
      defaultPath: this.getDefaultPath(options?.startIn),
      filters: filters,
    });

    if (!selected) {
      return []; // User cancelled
    }

    const paths = Array.isArray(selected) ? selected : [selected];

    // Read files and convert to File objects
    const files = await Promise.all(
      paths.map(async (path) => {
        const content = await readBinaryFile(path);
        const name = path.split('/').pop() || path.split('\\').pop() || 'file';
        const blob = new Blob([content]);

        return new File([blob], name, {
          type: this.guessMimeType(name),
        });
      })
    );

    return files;
  }

  async saveFile(data: Blob | string, options?: SaveFileOptions): Promise<boolean> {
    const filters = this.parseAcceptToFilters(options?.accept);

    const path = await save({
      defaultPath: options?.suggestedName,
      filters: filters,
    });

    if (!path) {
      return false; // User cancelled
    }

    try {
      if (typeof data === 'string') {
        await writeTextFile(path, data);
      } else {
        const buffer = await data.arrayBuffer();
        await writeBinaryFile(path, new Uint8Array(buffer));
      }
      return true;
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  }

  async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(reader.error);
      };
      reader.readAsText(file);
    });
  }

  async readFileAsBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as ArrayBuffer);
      };
      reader.onerror = () => {
        reject(reader.error);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  getCapabilities(): FileServiceCapabilities {
    return {
      nativeFilePicker: true,
      directoryPicker: true,
      multiplePicker: true,
      pathAccess: true,
    };
  }

  private parseAcceptToFilters(accept?: string | string[]): Array<{ name: string; extensions: string[] }> {
    if (!accept) return [];

    const accepts = Array.isArray(accept) ? accept : [accept];
    const extensions: string[] = [];

    accepts.forEach((a) => {
      if (a.startsWith('.')) {
        extensions.push(a.slice(1)); // Remove leading dot
      } else if (a.includes('/')) {
        // MIME type - convert to extension if possible
        const ext = this.mimeToExtension(a);
        if (ext) extensions.push(ext);
      }
    });

    if (extensions.length === 0) return [];

    return [
      {
        name: 'Files',
        extensions,
      },
    ];
  }

  private mimeToExtension(mime: string): string | null {
    const map: Record<string, string> = {
      'text/plain': 'txt',
      'application/json': 'json',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'application/pdf': 'pdf',
    };

    return map[mime] || null;
  }

  private guessMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      txt: 'text/plain',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      pdf: 'application/pdf',
    };

    return map[ext || ''] || 'application/octet-stream';
  }

  private getDefaultPath(startIn?: string): string | undefined {
    if (!startIn) return undefined;

    const map: Record<string, string> = {
      desktop: '$DESKTOP',
      documents: '$DOCUMENT',
      downloads: '$DOWNLOAD',
      music: '$AUDIO',
      pictures: '$PICTURE',
      videos: '$VIDEO',
    };

    return map[startIn];
  }
}
