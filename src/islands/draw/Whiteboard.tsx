import { useEffect, useState, type ComponentType } from 'react';
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

  useEffect(() => {
    let alive = true;
    import('@excalidraw/excalidraw')
      .then(m => { if (alive) setExcalidraw(() => m.Excalidraw); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A full whiteboard for sketches, diagrams, flowcharts, and mind maps. Everything stays in your
        browser — export as PNG/SVG or a reusable <code>.excalidraw</code> file from the menu.
      </p>
      <div className="h-[75vh] w-full overflow-hidden border-2 border-border">
        {failed ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Couldn't load the whiteboard. Please refresh the page.
          </div>
        ) : Excalidraw ? (
          <Excalidraw />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            Loading whiteboard…
          </div>
        )}
      </div>
    </div>
  );
}
