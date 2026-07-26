import type { FileSource } from '@/types/service';

export class FileService {
  async getFiles(source: FileSource): Promise<File[]> {
    if (source instanceof File) {
      return [source];
    }

    if (Array.isArray(source)) {
      return source;
    }

    // FileList
    return Array.from(source);
  }

  async getFileHandle(file: File): Promise<FileSystemFileHandle | null> {
    // File System Access API - may not be available
    if (!('showOpenFilePicker' in window)) {
      return null;
    }

    // If file already has a handle (from showOpenFilePicker), return it
    // For now, return null - will be enhanced when needed
    return null;
  }

  async createTempFile(name: string): Promise<FileSystemFileHandle | null> {
    // OPFS (Origin Private File System)
    if (!('storage' in navigator) || !navigator.storage.getDirectory) {
      return null;
    }

    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(name, { create: true });
      return fileHandle;
    } catch (error) {
      console.error('Failed to create temp file:', error);
      return null;
    }
  }

  async cleanupTempFiles(): Promise<void> {
    if (!('storage' in navigator) || !navigator.storage.getDirectory) {
      return;
    }

    try {
      const root = await navigator.storage.getDirectory();
      // @ts-expect-error - entries() may not be in types yet
      for await (const [name, handle] of root.entries()) {
        if (handle.kind === 'file') {
          await root.removeEntry(name);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }
}

// Singleton instance
export const fileService = new FileService();
