import { useEffect, useState } from 'react';
import type { Remote } from 'comlink';
import { workerPool } from '@/services/worker.service';

export function useWorker<T>(toolId: string, workerUrl: URL | string): Remote<T> | null {
  const [worker, setWorker] = useState<Remote<T> | null>(null);

  useEffect(() => {
    let mounted = true;

    console.log('useWorker: Initializing worker for', toolId);
    const urlString = typeof workerUrl === 'string' ? workerUrl : workerUrl.href;
    console.log('useWorker: Worker URL:', urlString);

    workerPool.getWorker<T>(toolId, urlString)
      .then(proxy => {
        if (mounted) {
          console.log('useWorker: Worker ready for', toolId);
          setWorker(proxy);
        }
      })
      .catch(error => {
        console.error('useWorker: Failed to create worker:', error);
      });

    return () => {
      mounted = false;
      console.log('useWorker: Cleaning up worker for', toolId);
      workerPool.terminateWorker(toolId);
    };
  }, [toolId, typeof workerUrl === 'string' ? workerUrl : workerUrl.href]);

  return worker;
}
