// src/services/download/browser.ts
import type { DownloadService, BlobFile, DownloadServiceCapabilities } from './types';

export class BrowserDownloadService implements DownloadService {
  async download(blob: Blob, filename: string): Promise<void> {
    // Try File System Access API first
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (error) {
        // User cancelled or API not available, fall through to blob URL
        if ((error as Error).name === 'AbortError') {
          return; // User cancelled
        }
      }
    }

    // Fallback to blob URL download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  async downloadZip(files: BlobFile[], zipName: string): Promise<void> {
    const { zip } = await import('fflate');

    const entries: Record<string, Uint8Array> = {};
    for (const { blob, filename } of files) {
      entries[filename] = new Uint8Array(await blob.arrayBuffer());
    }

    // level 0 (store) — the inputs (PNGs) are already compressed, so deflating
    // them again wastes CPU for no size win.
    const zipped = await new Promise<Uint8Array>((resolve, reject) =>
      zip(entries, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)))
    );

    await this.download(new Blob([zipped], { type: 'application/zip' }), zipName);
  }

  getCapabilities(): DownloadServiceCapabilities {
    return {
      nativeSaveDialog: typeof (window as any).showSaveFilePicker === 'function',
      zipSupport: true,
    };
  }
}
