export class PersistenceService {
  private dirtyTools = new Set<string>();
  private navigationGuards = new Set<string>();

  async autoSave(toolId: string, data: any): Promise<void> {
    const key = `gwt-autosave-${toolId}`;
    localStorage.setItem(key, JSON.stringify(data));
  }

  async loadAutoSave(toolId: string): Promise<any | null> {
    const key = `gwt-autosave-${toolId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }

  async clearAutoSave(toolId: string): Promise<void> {
    const key = `gwt-autosave-${toolId}`;
    localStorage.removeItem(key);
  }

  async saveToFile(
    data: Blob,
    suggestedName: string,
    fileHandle?: FileSystemFileHandle
  ): Promise<FileSystemFileHandle | null> {
    if (!('showSaveFilePicker' in window)) {
      return null;
    }

    try {
      const handle = fileHandle || await (window as any).showSaveFilePicker({
        suggestedName,
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return handle;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  async loadFromFile(accept?: string[]): Promise<{ data: ArrayBuffer; handle: FileSystemFileHandle } | null> {
    if (!('showOpenFilePicker' in window)) {
      return null;
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: accept ? [{
          accept: { 'application/json': accept }
        }] : undefined
      });
      const file = await handle.getFile();
      const data = await file.arrayBuffer();
      return { data, handle };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  markDirty(toolId: string): void {
    this.dirtyTools.add(toolId);
  }

  markClean(toolId: string): void {
    this.dirtyTools.delete(toolId);
  }

  isDirty(toolId: string): boolean {
    return this.dirtyTools.has(toolId);
  }

  enableNavigationGuard(toolId: string): void {
    this.navigationGuards.add(toolId);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  disableNavigationGuard(toolId: string): void {
    this.navigationGuards.delete(toolId);
    if (this.navigationGuards.size === 0) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
  }

  private handleBeforeUnload = (e: BeforeUnloadEvent): string | undefined => {
    for (const toolId of this.navigationGuards) {
      if (this.isDirty(toolId)) {
        e.preventDefault();
        return '';
      }
    }
    return undefined;
  };
}

// Singleton instance
export const persistenceService = new PersistenceService();
