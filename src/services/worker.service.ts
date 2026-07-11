import { wrap, type Remote } from 'comlink';

export class WorkerPool {
  private workers = new Map<string, Worker>();
  private proxies = new Map<string, Remote<any>>();

  async getWorker<T>(toolId: string, workerUrl: string): Promise<Remote<T>> {
    // Return cached proxy if exists
    if (this.proxies.has(toolId)) {
      console.log('WorkerPool: Returning cached worker for', toolId);
      return this.proxies.get(toolId)!;
    }

    console.log('WorkerPool: Creating new worker for', toolId);
    console.log('WorkerPool: Worker URL:', workerUrl);

    // Create new worker
    const worker = new Worker(workerUrl, { type: 'module' });

    // Add error listener
    worker.onerror = (error) => {
      console.error('WorkerPool: Worker error for', toolId, error);
    };

    const proxy = wrap<T>(worker);
    console.log('WorkerPool: Proxy created, methods:', Object.keys(proxy));

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
