import { useEffect, useRef, useState } from 'react';
import type { Remote } from 'comlink';
import { workerPool } from '@/services/worker.service';

/**
 * Loads a Comlink-wrapped worker for a tool.
 *
 * Comlink proxies are callable functions, so they cannot be stored directly in
 * useState — React would treat the proxy as a functional updater and invoke it.
 * The proxy lives in a ref; a `ready` flag triggers the re-render so consumers
 * pick it up once the worker is available.
 */
export function useWorker<T>(toolId: string, workerUrl: URL | string): Remote<T> | null {
  const workerApiRef = useRef<Remote<T> | null>(null);
  const [ready, setReady] = useState(false);
  const urlString = typeof workerUrl === 'string' ? workerUrl : workerUrl.href;

  useEffect(() => {
    let mounted = true;

    workerPool
      .getWorker<T>(toolId, urlString)
      .then(proxy => {
        if (mounted) {
          workerApiRef.current = proxy;
          setReady(true);
        }
      })
      .catch(error => {
        console.error('useWorker: failed to create worker for', toolId, error);
      });

    return () => {
      mounted = false;
      workerApiRef.current = null;
      setReady(false);
      workerPool.terminateWorker(toolId);
    };
  }, [toolId, urlString]);

  return ready ? workerApiRef.current : null;
}
