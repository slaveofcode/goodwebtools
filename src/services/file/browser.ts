// src/services/file/browser.ts
import type {
  FileService,
  FilePickerOptions,
  SaveFileOptions,
  FileServiceCapabilities,
} from './types';

export class BrowserFileService implements FileService {
  async openFile(options?: FilePickerOptions): Promise<File[]> {
    // Check if File System Access API is available
    if ('showOpenFilePicker' in window) {
      return this.openFileModern(options);
    } else {
      return this.openFileLegacy(options);
    }
  }

  private async openFileModern(options?: FilePickerOptions): Promise<File[]> {
    const pickerOpts: any = {
      multiple: options?.multiple || false,
      startIn: options?.startIn || 'documents',
    };

    if (options?.accept) {
      const accepts = Array.isArray(options.accept) ? options.accept : [options.accept];
      pickerOpts.types = [
        {
          description: 'Files',
          accept: {
            '*/*': accepts,
          },
        },
      ];
    }

    const handles = await (window as any).showOpenFilePicker(pickerOpts);
    const files = await Promise.all(
      handles.map(async (handle: any) => {
        return await handle.getFile();
      })
    );

    return files;
  }

  private async openFileLegacy(options?: FilePickerOptions): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options?.multiple || false;

      if (options?.accept) {
        const accepts = Array.isArray(options.accept) ? options.accept : [options.accept];
        input.accept = accepts.join(',');
      }

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          resolve(Array.from(input.files));
        } else {
          reject(new Error('No files selected'));
        }
      };

      input.oncancel = () => {
        reject(new Error('File selection cancelled'));
      };

      input.click();
    });
  }

  async saveFile(data: Blob | string, options?: SaveFileOptions): Promise<boolean> {
    const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : data;

    // Check if File System Access API is available
    if ('showSaveFilePicker' in window) {
      return this.saveFileModern(blob, options);
    } else {
      return this.saveFileLegacy(blob, options);
    }
  }

  private async saveFileModern(blob: Blob, options?: SaveFileOptions): Promise<boolean> {
    try {
      const pickerOpts: any = {
        suggestedName: options?.suggestedName || 'download',
        startIn: options?.startIn || 'downloads',
      };

      if (options?.accept) {
        const accepts = Array.isArray(options.accept) ? options.accept : [options.accept];
        pickerOpts.types = [
          {
            description: 'Files',
            accept: {
              [blob.type || '*/*']: accepts,
            },
          },
        ];
      }

      const handle = await (window as any).showSaveFilePicker(pickerOpts);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return true;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return false; // User cancelled
      }
      throw error;
    }
  }

  private async saveFileLegacy(blob: Blob, options?: SaveFileOptions): Promise<boolean> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options?.suggestedName || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true; // Can't detect cancellation in legacy mode
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
    const hasModernAPI = 'showOpenFilePicker' in window;

    return {
      nativeFilePicker: hasModernAPI,
      directoryPicker: hasModernAPI && 'showDirectoryPicker' in window,
      multiplePicker: true,
      pathAccess: false, // Browser can't access full file paths
    };
  }
}
