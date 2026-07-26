import { setProgress, removeProgress, progressMap } from '@/stores/worker.store';

export class ProgressService {
  startProgress(id: string, label: string): void {
    setProgress(id, label, 0);
  }

  updateProgress(id: string, percent: number): void {
    const current = progressMap.get()[id];
    if (current) {
      setProgress(id, current.label, percent);
    }
  }

  completeProgress(id: string): void {
    removeProgress(id);
  }

  toast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    console.log(`[${type.toUpperCase()}]`, message);
  }
}

// Singleton instance
export const progressService = new ProgressService();

// Re-export for convenience
export { progressMap };
