import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Expand a tool area to fill the screen (games, canvases). Tries the native
 * Fullscreen API first — on Android that hides the browser chrome entirely —
 * and falls back to a CSS fixed overlay driven by the returned `expanded`
 * flag (iOS Safari has no element fullscreen). Esc and native fullscreen
 * exit both collapse the state.
 */
export function useExpand<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [expanded, setExpanded] = useState(false);

  const enter = useCallback(() => {
    setExpanded(true);
    ref.current?.requestFullscreen?.().catch(() => { /* overlay fallback */ });
  }, []);

  const exit = useCallback(() => {
    setExpanded(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* already exited */ });
    }
  }, []);

  useEffect(() => {
    if (!expanded) return;
    // Leaving native fullscreen (Esc, back gesture) must also collapse the UI.
    const onFsChange = () => { if (!document.fullscreenElement) setExpanded(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exit(); };
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded, exit]);

  return { ref, expanded, enter, exit };
}
