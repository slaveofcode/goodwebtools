import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Maximize2, Minimize2, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { loadScene, saveScene, type WhiteboardScene } from '@/tools/draw/whiteboard.store';
import '@excalidraw/excalidraw/index.css';

const SAVE_INTERVAL = 30; // seconds between autosaves

// Serve Excalidraw's fonts from our own origin (copied to public/excalidraw)
// instead of its default esm.sh CDN — keeps the zero-external-request promise.
if (typeof window !== 'undefined') {
  (window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';
}

export default function Whiteboard() {
  // Excalidraw is a large, browser-only React component — load it after mount
  // so it never runs during SSR.
  const [Excalidraw, setExcalidraw] = useState<ComponentType<Record<string, unknown>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Pin the expanded overlay's top to the sticky header's actual bottom so there
  // is never a gap, regardless of the header's rendered height.
  const [navBottom, setNavBottom] = useState(67);
  // Seconds until the next autosave. 0 means nothing pending (saved / no changes),
  // so the countdown only runs while there are unsaved changes.
  const [countdown, setCountdown] = useState(0);

  // Remember whether the board was expanded, so it stays expanded on return.
  const setExpandedPersist = (v: boolean) => {
    setExpanded(v);
    try { localStorage.setItem('gwt-whiteboard-expanded', v ? '1' : '0'); } catch { /* ignore */ }
  };
  useEffect(() => {
    if (localStorage.getItem('gwt-whiteboard-expanded') === '1') setExpanded(true);
  }, []);

  // Restore the last scene (client-only). Excalidraw accepts a Promise for
  // initialData, so this loads the persisted drawing before it renders.
  const initialDataRef = useRef<ReturnType<typeof loadScene> | undefined>(undefined);
  if (typeof window !== 'undefined' && initialDataRef.current === undefined) {
    initialDataRef.current = loadScene();
  }
  // Changes are buffered and flushed on a fixed cadence (every SAVE_INTERVAL s)
  // rather than on every keystroke, so saving isn't constant. A short warm-up
  // ignores Excalidraw's own init onChange so we don't count down with no edits.
  const latestScene = useRef<WhiteboardScene | null>(null);
  const dirty = useRef(false);
  const ready = useRef(false);
  const sceneVersionOf = useRef<(els: readonly unknown[]) => number>(() => 0);
  const savedVersion = useRef<number | null>(null);

  const flushSave = () => {
    if (!latestScene.current || !dirty.current) return;
    dirty.current = false;
    savedVersion.current = sceneVersionOf.current(latestScene.current.elements);
    setCountdown(0); // back to the "Saved" state; countdown stops
    void saveScene(latestScene.current);
  };

  const onChange = (
    elements: readonly unknown[],
    appState: Record<string, unknown>,
    files: Record<string, unknown>,
  ) => {
    latestScene.current = {
      elements,
      appState: { viewBackgroundColor: appState?.viewBackgroundColor },
      files,
    };
    const version = sceneVersionOf.current(elements);
    // Baseline on the first change (restored scene) and during warm-up.
    if (savedVersion.current === null || !ready.current) { savedVersion.current = version; return; }
    // Only a genuine element change starts the countdown.
    if (version !== savedVersion.current && !dirty.current) {
      dirty.current = true;
      setCountdown(SAVE_INTERVAL);
    }
  };

  useEffect(() => {
    // Warm-up so the initial (non-user) onChange doesn't start a countdown.
    const warm = setTimeout(() => { ready.current = true; }, 1500);
    // One shared 1-second tick drives the countdown and triggers the save at 0.
    const tick = setInterval(() => {
      if (!dirty.current) return;
      setCountdown((c) => {
        if (c <= 1) { flushSave(); return 0; }
        return c - 1;
      });
    }, 1000);
    // Save immediately when the tab is hidden/closed so the last edits aren't lost.
    const onHide = () => { if (document.visibilityState === 'hidden') flushSave(); };
    // Warn before leaving with buffered (not-yet-saved) changes. The browser only
    // allows its own native confirmation here — a custom modal can't block a close.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) { e.preventDefault(); e.returnValue = ''; }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushSave);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearTimeout(warm);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushSave);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    import('@excalidraw/excalidraw')
      .then(m => {
        if (!alive) return;
        // getSceneVersion changes only on real element edits, not on cursor /
        // selection / hover onChange noise — so we can tell "actually changed".
        sceneVersionOf.current = m.getSceneVersion as (els: readonly unknown[]) => number;
        setExcalidraw(() => m.Excalidraw);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  // Esc collapses the expanded view (Excalidraw handles Esc for its own
  // selection first, so this only fires when nothing intercepts it).
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedPersist(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Measure the sticky header's bottom edge so the overlay butts right up to it.
  useEffect(() => {
    if (!expanded) return;
    const measure = () => {
      const rect = document.querySelector('header')?.getBoundingClientRect();
      setNavBottom(rect ? Math.round(rect.bottom) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [expanded]);

  const statusIndicator = countdown > 0 ? (
    <button
      onClick={flushSave}
      title="Save now"
      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-600 underline underline-offset-2 hover:text-amber-700"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
      Unsaved · save now ({countdown}s)
    </button>
  ) : (
    <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      <Check className="h-3.5 w-3.5" /> Saved
    </span>
  );

  const canvas = failed ? (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      Couldn&apos;t load the whiteboard. Please refresh the page.
    </div>
  ) : Excalidraw ? (
    <Excalidraw initialData={initialDataRef.current} onChange={onChange} />
  ) : (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      Loading whiteboard…
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          A full whiteboard for sketches, diagrams, flowcharts, and mind maps. Everything stays in your
          browser — export as PNG/SVG or a reusable <code>.excalidraw</code> file from the menu. Powered by{' '}
          <a
            href="https://excalidraw.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-foreground underline underline-offset-2 hover:text-accent"
          >
            Excalidraw
          </a>{' '}
          — you can also use it at excalidraw.com.
        </p>
        <div className="flex items-center gap-3">
          {statusIndicator}
          {!expanded && (
            <Button variant="secondary" onClick={() => setExpandedPersist(true)}>
              <Maximize2 className="h-4 w-4" />
              Expand
            </Button>
          )}
        </div>
      </div>

      {/* Same wrapper element in both states so Excalidraw is never remounted
          (the drawing is preserved). Expanded = a fixed overlay that fills the
          viewport below the sticky navbar (which stays visible at top). */}
      <div
        className={
          expanded
            ? 'fixed inset-x-0 bottom-0 z-30 !mt-0 overflow-hidden border-t-2 border-border bg-background'
            : 'h-[75vh] w-full overflow-hidden border-2 border-border'
        }
        style={expanded ? { top: navBottom } : undefined}
      >
        {canvas}
      </div>

      {expanded && (
        <div className="fixed right-4 z-40 flex items-center gap-3" style={{ top: navBottom + 8 }}>
          <div className="border-2 border-border bg-background px-2 py-1.5 shadow-brutal-sm">
            {statusIndicator}
          </div>
          <Button variant="secondary" onClick={() => setExpandedPersist(false)} className="shadow-brutal">
            <Minimize2 className="h-4 w-4" />
            Exit
          </Button>
        </div>
      )}
    </div>
  );
}
