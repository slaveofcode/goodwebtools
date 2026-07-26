// src/services/file/types.ts

export interface FilePickerOptions {
  multiple?: boolean;
  accept?: string | string[]; // MIME types or extensions like '.txt,.json'
  directory?: boolean;
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

export interface SaveFileOptions {
  suggestedName?: string;
  accept?: string | string[];
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

export interface FileInfo {
  name: string;
  path?: string; // Full path (Tauri only)
  size: number;
  type: string;
  lastModified: number;
}

export interface FileService {
  openFile(options?: FilePickerOptions): Promise<File[]>;
  saveFile(data: Blob | string, options?: SaveFileOptions): Promise<boolean>;
  readFile(file: File): Promise<string>;
  readFileAsBuffer(file: File): Promise<ArrayBuffer>;
  getCapabilities(): FileServiceCapabilities;
}

export interface FileServiceCapabilities {
  nativeFilePicker: boolean;
  directoryPicker: boolean;
  multiplePicker: boolean;
  pathAccess: boolean; // Can get full file path
}
