import { useEffect, useState, type ComponentType } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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

  const canvas = failed ? (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      Couldn&apos;t load the whiteboard. Please refresh the page.
    </div>
  ) : Excalidraw ? (
    <Excalidraw />
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
        {!expanded && (
          <Button variant="secondary" onClick={() => setExpanded(true)}>
            <Maximize2 className="h-4 w-4" />
            Expand
          </Button>
        )}
      </div>

      {/* Same wrapper element in both states so Excalidraw is never remounted
          (the drawing is preserved). Expanded = a fixed overlay that fills the
          viewport below the sticky navbar (which stays visible at top). */}
      <div
        className={
          expanded
            ? 'fixed inset-x-0 bottom-0 top-[67px] z-30 overflow-hidden border-t-2 border-border bg-background'
            : 'h-[75vh] w-full overflow-hidden border-2 border-border'
        }
      >
        {canvas}
      </div>

      {expanded && (
        <Button
          variant="secondary"
          onClick={() => setExpanded(false)}
          className="fixed right-4 top-[75px] z-40 shadow-brutal"
        >
          <Minimize2 className="h-4 w-4" />
          Exit
        </Button>
      )}
    </div>
  );
}
