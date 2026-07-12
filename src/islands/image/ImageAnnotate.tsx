import { useEffect, useRef, useState } from 'react';
import {
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Pencil,
  Highlighter,
  Type,
  Droplets,
  Undo2,
  Redo2,
  Trash2,
  Download,
} from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { downloadService } from '@/services/download.service';
import { usePasteImage } from '@/hooks/usePasteImage';

type Tool = 'rect' | 'ellipse' | 'line' | 'arrow' | 'pencil' | 'highlighter' | 'text' | 'blur';

interface Shape {
  type: Tool;
  color: string;
  width: number;
  rounded?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x2?: number;
  y2?: number;
  points?: [number, number][];
  text?: string;
  size?: number;
}

const TOOLS: { tool: Tool; label: string; Icon: typeof Square }[] = [
  { tool: 'rect', label: 'Rectangle', Icon: Square },
  { tool: 'ellipse', label: 'Ellipse', Icon: Circle },
  { tool: 'line', label: 'Line', Icon: Minus },
  { tool: 'arrow', label: 'Arrow', Icon: ArrowUpRight },
  { tool: 'pencil', label: 'Pencil', Icon: Pencil },
  { tool: 'highlighter', label: 'Highlighter', Icon: Highlighter },
  { tool: 'text', label: 'Text', Icon: Type },
  { tool: 'blur', label: 'Blur', Icon: Droplets },
];

function drawPath(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, blur: HTMLCanvasElement | null) {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const x = s.x ?? 0;
  const y = s.y ?? 0;
  const w = s.w ?? 0;
  const h = s.h ?? 0;

  switch (s.type) {
    case 'rect':
      if (s.rounded && typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.15 + s.width);
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, w, h);
      }
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'line':
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(s.x2 ?? x, s.y2 ?? y);
      ctx.stroke();
      break;
    case 'arrow': {
      const x2 = s.x2 ?? x;
      const y2 = s.y2 ?? y;
      const angle = Math.atan2(y2 - y, x2 - x);
      const len = Math.hypot(x2 - x, y2 - y);
      // Proportional head; never longer than the arrow itself.
      const headLen = Math.min(len, Math.max(14, s.width * 4.5));
      const headHalf = Math.max(7, s.width * 2.2);
      // Base of the arrowhead, pulled back from the tip along the shaft.
      const bx = x2 - headLen * Math.cos(angle);
      const by = y2 - headLen * Math.sin(angle);
      // Flat-capped shaft that stops at the head base (no round tail blob).
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(bx, by);
      ctx.stroke();
      // Filled triangular head.
      const px = Math.cos(angle + Math.PI / 2);
      const py = Math.sin(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(bx + headHalf * px, by + headHalf * py);
      ctx.lineTo(bx - headHalf * px, by - headHalf * py);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'pencil':
      if (s.points) {
        drawPath(ctx, s.points);
        ctx.stroke();
      }
      break;
    case 'highlighter':
      if (s.points) {
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = 'multiply';
        ctx.lineWidth = s.width * 4;
        drawPath(ctx, s.points);
        ctx.stroke();
      }
      break;
    case 'text':
      ctx.font = `${s.size ?? 24}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(s.text ?? '', x, y);
      break;
    case 'blur':
      if (blur && w > 0 && h > 0) ctx.drawImage(blur, x, y, w, h, x, y, w, h);
      break;
  }
  ctx.restore();
}

export default function ImageAnnotate() {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const blurRef = useRef<HTMLCanvasElement | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const draftRef = useRef<Shape | null>(null);
  const drawingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against the spurious blur that fires the instant the text input
  // mounts (the placing click steals focus back to the body). We only treat a
  // blur as a real "done editing" once the input has actually been focused.
  const textReadyRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [color, setColor] = useState('#ff3b30');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [rounded, setRounded] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [undone, setUndone] = useState<Shape[]>([]);
  const [textEdit, setTextEdit] = useState<{ nx: number; ny: number; left: number; top: number } | null>(null);
  const [textValue, setTextValue] = useState('');

  const scaleX = () => {
    const c = viewRef.current;
    return c ? c.width / c.getBoundingClientRect().width : 1;
  };

  const rebuildBase = () => {
    const base = baseRef.current;
    const bmp = bitmapRef.current;
    if (!base || !bmp) return;
    const ctx = base.getContext('2d')!;
    ctx.clearRect(0, 0, base.width, base.height);
    ctx.drawImage(bmp, 0, 0);
    for (const s of shapes) drawShape(ctx, s, blurRef.current);
  };

  const redraw = (preview?: Shape | null) => {
    const view = viewRef.current;
    const base = baseRef.current;
    if (!view || !base) return;
    const ctx = view.getContext('2d')!;
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(base, 0, 0);
    if (preview) drawShape(ctx, preview, blurRef.current);
  };

  // Rebuild whenever the committed shapes change.
  useEffect(() => {
    if (!ready) return;
    rebuildBase();
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, ready]);

  const onDrop = async (files: File[]) => {
    const image = files.find(f => f.type.startsWith('image/'));
    if (!image) return;
    setFile(image);
    setShapes([]);
    setUndone([]);
    setReady(false);
    const bmp = await createImageBitmap(image);
    bitmapRef.current = bmp;
    const w = bmp.width;
    const h = bmp.height;

    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    baseRef.current = base;

    const blur = document.createElement('canvas');
    blur.width = w;
    blur.height = h;
    const blurCtx = blur.getContext('2d')!;
    blurCtx.filter = `blur(${Math.max(8, Math.round(Math.min(w, h) / 45))}px)`;
    blurCtx.drawImage(bmp, 0, 0);
    blurCtx.filter = 'none';
    blurRef.current = blur;

    setDims({ w, h });
    setReady(true);
  };

  usePasteImage(f => onDrop([f]));

  const pointer = (e: React.PointerEvent) => {
    const c = viewRef.current!;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!ready) return;
    const p = pointer(e);
    const natWidth = strokeWidth * scaleX();

    if (tool === 'text') {
      const rect = viewRef.current!.getBoundingClientRect();
      setTextEdit({ nx: p.x, ny: p.y, left: e.clientX - rect.left, top: e.clientY - rect.top });
      setTextValue('');
      return;
    }

    drawingRef.current = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (tool === 'pencil' || tool === 'highlighter') {
      draftRef.current = { type: tool, color, width: natWidth, points: [[p.x, p.y]] };
    } else if (tool === 'line' || tool === 'arrow') {
      draftRef.current = { type: tool, color, width: natWidth, x: p.x, y: p.y, x2: p.x, y2: p.y };
    } else {
      draftRef.current = { type: tool, color, width: natWidth, rounded, x: p.x, y: p.y, w: 0, h: 0 };
    }
  };

  const originRef = useRef<{ x: number; y: number } | null>(null);
  const handleDown = (e: React.PointerEvent) => {
    if (ready && tool !== 'text') originRef.current = pointer(e);
    onDown(e);
  };
  const handleMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !draftRef.current) return;
    const p = pointer(e);
    const d = draftRef.current;
    if (d.type === 'pencil' || d.type === 'highlighter') {
      d.points!.push([p.x, p.y]);
    } else if (d.type === 'line' || d.type === 'arrow') {
      d.x2 = p.x;
      d.y2 = p.y;
    } else if (originRef.current) {
      const o = originRef.current;
      d.x = Math.min(o.x, p.x);
      d.y = Math.min(o.y, p.y);
      d.w = Math.abs(p.x - o.x);
      d.h = Math.abs(p.y - o.y);
    }
    redraw(d);
  };
  const handleUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const d = draftRef.current;
    draftRef.current = null;
    originRef.current = null;
    if (!d) return;
    const tiny =
      (d.type === 'pencil' || d.type === 'highlighter') && (d.points?.length ?? 0) < 2;
    const empty =
      (d.type === 'rect' || d.type === 'ellipse' || d.type === 'blur') &&
      (Math.abs(d.w ?? 0) < 3 || Math.abs(d.h ?? 0) < 3);
    if (tiny || empty) {
      redraw();
      return;
    }
    setShapes(prev => [...prev, d]);
    setUndone([]);
  };

  // Focus the text input a frame after it mounts, then arm blur-to-commit.
  // The placing click fires a blur before this rAF runs, so that early blur is
  // ignored (textReadyRef is still false) and the input survives.
  useEffect(() => {
    if (!textEdit) {
      textReadyRef.current = false;
      return;
    }
    textReadyRef.current = false;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      textReadyRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [textEdit]);

  const commitText = () => {
    if (textEdit && textValue.trim()) {
      const size = Math.max(14, strokeWidth * scaleX() * 5);
      setShapes(prev => [
        ...prev,
        { type: 'text', color, width: 1, x: textEdit.nx, y: textEdit.ny, text: textValue, size },
      ]);
      setUndone([]);
    }
    setTextEdit(null);
    setTextValue('');
  };

  const undo = () => {
    setShapes(prev => {
      if (!prev.length) return prev;
      setUndone(u => [...u, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  };
  const redo = () => {
    setUndone(prev => {
      if (!prev.length) return prev;
      setShapes(s => [...s, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  };
  const clearAll = () => {
    setShapes([]);
    setUndone([]);
  };

  const download = async () => {
    const base = baseRef.current;
    if (!base) return;
    const blob = await new Promise<Blob>((res, rej) =>
      base.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/png')
    );
    const name = file ? file.name.replace(/\.[^.]+$/, '') + '-annotated.png' : 'annotated.png';
    await downloadService.download(blob, name);
  };

  return (
    <div className="space-y-4">
      {!file && (
        <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">Drop an image or click to browse</p>
            <p className="text-sm text-muted-foreground">
              Annotate with shapes, arrows, text, highlighter, and blur
            </p>
          </div>
        </Dropzone>
      )}

      {file && ready && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {TOOLS.map(({ tool: t, label, Icon }) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                aria-pressed={tool === t}
                title={label}
                className={`border-2 border-border p-2 shadow-brutal-sm press-brutal ${
                  tool === t ? 'bg-accent text-accent-foreground' : 'bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}

            <span className="mx-1 h-6 w-0.5 bg-border" />

            <label className="flex items-center gap-1" title="Color">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="h-9 w-10 cursor-pointer border-2 border-border bg-muted"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Width</span>
              <input
                type="range"
                min={2}
                max={20}
                value={strokeWidth}
                onChange={e => setStrokeWidth(Number(e.target.value))}
                className="w-24 accent-accent"
              />
            </label>
            {tool === 'rect' && (
              <label className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-2 py-1.5 text-sm">
                <input type="checkbox" checked={rounded} onChange={() => setRounded(r => !r)} className="accent-accent" />
                Rounded
              </label>
            )}

            <span className="mx-1 h-6 w-0.5 bg-border" />

            <button onClick={undo} disabled={!shapes.length} title="Undo" className="border-2 border-border bg-muted p-2 shadow-brutal-sm press-brutal disabled:opacity-30">
              <Undo2 className="h-4 w-4" />
            </button>
            <button onClick={redo} disabled={!undone.length} title="Redo" className="border-2 border-border bg-muted p-2 shadow-brutal-sm press-brutal disabled:opacity-30">
              <Redo2 className="h-4 w-4" />
            </button>
            <button onClick={clearAll} disabled={!shapes.length} title="Clear annotations" className="border-2 border-border bg-muted p-2 shadow-brutal-sm press-brutal disabled:opacity-30">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Canvas */}
          <div className="relative inline-block max-w-full overflow-auto border-2 border-border bg-muted">
            <canvas
              ref={viewRef}
              width={dims?.w}
              height={dims?.h}
              onPointerDown={handleDown}
              onPointerMove={handleMove}
              onPointerUp={handleUp}
              className="block h-auto w-auto min-w-[70vw] max-w-full touch-none"
              style={{ cursor: tool === 'text' ? 'text' : 'crosshair' }}
            />
            {textEdit && (
              <input
                ref={inputRef}
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onBlur={() => { if (textReadyRef.current) commitText(); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitText();
                  if (e.key === 'Escape') { setTextEdit(null); setTextValue(''); }
                }}
                placeholder="Type, then Enter"
                className="absolute border-2 border-accent bg-white px-1 text-sm text-black outline-none"
                style={{ left: textEdit.left, top: textEdit.top }}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
            <Button variant="ghost" onClick={() => { setFile(null); setReady(false); setShapes([]); setUndone([]); }}>
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
