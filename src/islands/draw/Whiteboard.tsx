import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Maximize2, Minimize2, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { loadScene, saveScene } from '@/tools/draw/whiteboard.store';
import '@excalidraw/excalidraw/index.css';

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
  const [saved, setSaved] = useState(false);

  // Restore the last scene (client-only). Excalidraw accepts a Promise for
  // initialData, so this loads the persisted drawing before it renders.
  const initialDataRef = useRef<ReturnType<typeof loadScene> | undefined>(undefined);
  if (typeof window !== 'undefined' && initialDataRef.current === undefined) {
    initialDataRef.current = loadScene();
  }
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave on every change, so nothing is lost on tab close / reboot.
  const onChange = (
    elements: readonly unknown[],
    appState: Record<string, unknown>,
    files: Record<string, unknown>,
  ) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveScene({
        elements,
        appState: { viewBackgroundColor: appState?.viewBackgroundColor },
        files,
      }).then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      });
    }, 600);
  };

  useEffect(() => {
    let alive = true;
    import('@excalidraw/excalidraw')
      .then(m => { if (alive) setExcalidraw(() => m.Excalidraw); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  // Esc collapses the expanded view (Excalidraw handles Esc for its own
  // selection first, so this only fires when nothing intercepts it).
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
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
          browser — export as PNG/SVG or a reusable <code>.excalidraw</code> file from the menu.
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {saved ? <><Check className="h-3.5 w-3.5" /> Saved</> : 'Auto-saved locally'}
          </span>
          {!expanded && (
            <Button variant="secondary" onClick={() => setExpanded(true)}>
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
        <Button
          variant="secondary"
          onClick={() => setExpanded(false)}
          className="fixed right-4 z-40 shadow-brutal"
          style={{ top: navBottom + 8 }}
        >
          <Minimize2 className="h-4 w-4" />
          Exit
        </Button>
      )}
    </div>
  );
}
