// src/services/download/types.ts

export interface BlobFile {
  blob: Blob;
  filename: string;
}

export interface DownloadService {
  download(blob: Blob, filename: string): Promise<void>;
  downloadZip(files: BlobFile[], zipName: string): Promise<void>;
  getCapabilities(): DownloadServiceCapabilities;
}

export interface DownloadServiceCapabilities {
  nativeSaveDialog: boolean;
  zipSupport: boolean;
}
