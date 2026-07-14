// src/services/download/tauri.ts
import { save } from '@tauri-apps/api/dialog';
import { writeBinaryFile } from '@tauri-apps/api/fs';
import type { DownloadService, BlobFile, DownloadServiceCapabilities } from './types';

export class TauriDownloadService implements DownloadService {
  async download(blob: Blob, filename: string): Promise<void> {
    const path = await save({
      defaultPath: filename,
    });

    if (!path) {
      return; // User cancelled
    }

    const buffer = await blob.arrayBuffer();
    await writeBinaryFile(path, new Uint8Array(buffer));
  }

  async downloadZip(files: BlobFile[], zipName: string): Promise<void> {
    const { zip } = await import('fflate');

    const entries: Record<string, Uint8Array> = {};
    for (const { blob, filename } of files) {
      entries[filename] = new Uint8Array(await blob.arrayBuffer());
    }

    const zipped = await new Promise<Uint8Array>((resolve, reject) =>
      zip(entries, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)))
    );

    await this.download(new Blob([zipped], { type: 'application/zip' }), zipName);
  }

  getCapabilities(): DownloadServiceCapabilities {
    return {
      nativeSaveDialog: true,
      zipSupport: true,
    };
  }
}
