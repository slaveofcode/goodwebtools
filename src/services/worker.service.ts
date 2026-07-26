import { wrap, type Remote } from 'comlink';

export class WorkerPool {
  private workers = new Map<string, Worker>();
  private proxies = new Map<string, Remote<any>>();

  async getWorker<T>(toolId: string, workerUrl: string): Promise<Remote<T>> {
    // Return cached proxy if exists
    if (this.proxies.has(toolId)) {
      return this.proxies.get(toolId)!;
    }

    const worker = new Worker(workerUrl, { type: 'module' });
    worker.onerror = (error) => {
      console.error('WorkerPool: worker error for', toolId, error);
    };

    const proxy = wrap<T>(worker);

    this.workers.set(toolId, worker);
    this.proxies.set(toolId, proxy);

    return proxy;
  }

  terminateWorker(toolId: string): void {
    const worker = this.workers.get(toolId);
    if (worker) {
      worker.terminate();
      this.workers.delete(toolId);
      this.proxies.delete(toolId);
    }
  }

  terminateAll(): void {
    for (const worker of this.workers.values()) {
      worker.terminate();
    }
    this.workers.clear();
    this.proxies.clear();
  }
}

// Singleton instance
export const workerPool = new WorkerPool();
