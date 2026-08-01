import { useCallback, useEffect, useRef } from 'react';

// Minimal typing so we don't depend on the DOM lib shipping WakeLock types.
interface WakeLockSentinelLike { release(): Promise<void> }
interface WakeLockLike { request(type: 'screen'): Promise<WakeLockSentinelLike> }
function getWakeLock(): WakeLockLike | undefined {
  return (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock;
}

/**
 * Keep the screen awake during a long operation (e.g. model download / inference)
 * so the phone doesn't auto-lock — which on mobile can discard the tab and wipe
 * in-memory state. The lock is auto-released by the browser when the page is
 * hidden, so we re-acquire it on return to the foreground.
 */
export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const wantedRef = useRef(false);

  const acquire = useCallback(async () => {
    const wl = getWakeLock();
    if (!wl || sentinelRef.current) return;
    try { sentinelRef.current = await wl.request('screen'); } catch { /* denied/unsupported */ }
  }, []);

  const request = useCallback(async () => { wantedRef.current = true; await acquire(); }, [acquire]);

  const release = useCallback(() => {
    wantedRef.current = false;
    sentinelRef.current?.release().catch(() => {});
    sentinelRef.current = null;
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wantedRef.current && !sentinelRef.current) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [acquire]);

  return { request, release };
}
