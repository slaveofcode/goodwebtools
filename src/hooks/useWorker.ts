import { useEffect, useRef } from 'react';
import type { Remote } from 'comlink';
import { workerPool } from '@/services/worker.service';

export function useWorker<T>(toolId: string, workerUrl: URL): Remote<T> | null {
  const workerRef = useRef<Remote<T> | null>(null);

  useEffect(() => {
    let mounted = true;

    workerPool.getWorker<T>(toolId, workerUrl.href).then(proxy => {
      if (mounted) {
        workerRef.current = proxy;
      }
    });

    return () => {
      mounted = false;
      workerPool.terminateWorker(toolId);
    };
  }, [toolId, workerUrl.href]);

  return workerRef.current;
}
