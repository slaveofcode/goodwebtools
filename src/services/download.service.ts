export interface BlobFile {
  blob: Blob;
  filename: string;
}

export class DownloadService {
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
    // For Phase 0, not implemented yet
    // Will be added when zip functionality is needed
    throw new Error('Zip download not yet implemented');
  }
}

// Singleton instance
export const downloadService = new DownloadService();
