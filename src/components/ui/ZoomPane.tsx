import { useRef, useState, type ReactNode } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from './Button';

const MIN = 0.25;
const MAX = 8;

/** A checkerboard-backed pane that zooms (buttons + wheel) and pans (drag). */
export function ZoomPane({ children, className }: { children: ReactNode; className?: string }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z));
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.1 : 0.9)));
  };
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPan({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
  };
  const onPointerUp = () => { dragging.current = null; };

  return (
    <div className={`relative overflow-hidden border-2 border-border ${className ?? 'h-[70vh]'}`}>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <Button variant="secondary" onClick={() => setZoom((z) => clamp(z * 1.25))} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="secondary" onClick={() => setZoom((z) => clamp(z * 0.8))} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
        <Button variant="secondary" onClick={reset} aria-label="Fit"><Maximize className="h-4 w-4" /></Button>
      </div>
      <span className="absolute left-2 top-2 z-10 rounded bg-background/80 px-2 py-0.5 text-xs font-mono">{Math.round(zoom * 100)}%</span>
      <div
        className="flex h-full w-full cursor-grab items-center justify-center active:cursor-grabbing"
        style={{ backgroundImage: 'conic-gradient(#0000 90deg, #8883 0 180deg, #0000 0 270deg, #8883 0)', backgroundSize: '20px 20px' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>{children}</div>
      </div>
    </div>
  );
}
