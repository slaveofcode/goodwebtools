import { useEffect, useRef, useState } from 'react';
import {
  MousePointer2,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Pencil,
  Highlighter,
  Type,
  Droplets,
  ImagePlus,
  Undo2,
  Redo2,
  Trash2,
  Download,
} from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { downloadService } from '@/services/download';
import { usePasteImage } from '@/hooks/usePasteImage';
import { takePendingImage } from '@/services/handoff';

type Tool = 'select' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'pencil' | 'highlighter' | 'text' | 'blur';

interface Shape {
  type: Tool | 'image';
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
  /** Source for an imported-image overlay (type === 'image'). */
  img?: CanvasImageSource;
}

const TOOLS: { tool: Tool; label: string; Icon: typeof Square }[] = [
  { tool: 'select', label: 'Select / move', Icon: MousePointer2 },
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
    case 'image':
      if (s.img && w > 0 && h > 0) ctx.drawImage(s.img, x, y, w, h);
      break;
  }
  ctx.restore();
}

/** Axis-aligned bounding box of a shape, in natural image pixels. */
function shapeBounds(ctx: CanvasRenderingContext2D, s: Shape): { x: number; y: number; w: number; h: number } {
  if (s.type === 'line' || s.type === 'arrow') {
    const x = s.x ?? 0, y = s.y ?? 0, x2 = s.x2 ?? x, y2 = s.y2 ?? y;
    return { x: Math.min(x, x2), y: Math.min(y, y2), w: Math.abs(x2 - x), h: Math.abs(y2 - y) };
  }
  if (s.type === 'pencil' || s.type === 'highlighter') {
    const pts = s.points ?? [];
    if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of pts) {
      minX = Math.min(minX, px); minY = Math.min(minY, py);
      maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (s.type === 'text') {
    const size = s.size ?? 24;
    ctx.save();
    ctx.font = `${size}px sans-serif`;
    const w = ctx.measureText(s.text ?? '').width;
    ctx.restore();
    return { x: s.x ?? 0, y: s.y ?? 0, w, h: size };
  }
  // rect / ellipse / blur
  const x = s.x ?? 0, y = s.y ?? 0, w = s.w ?? 0, h = s.h ?? 0;
  return { x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h) };
}

/** Perpendicular distance from a point to a line segment. */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Whether a point (natural px) is close enough to a shape to select it. */
function shapeHit(ctx: CanvasRenderingContext2D, s: Shape, px: number, py: number): boolean {
  const pad = 10 + (s.width ?? 0);
  if (s.type === 'line' || s.type === 'arrow') {
    return distToSegment(px, py, s.x ?? 0, s.y ?? 0, s.x2 ?? s.x ?? 0, s.y2 ?? s.y ?? 0) <= pad;
  }
  if (s.type === 'pencil' || s.type === 'highlighter') {
    const pts = s.points ?? [];
    if (pts.length === 1) return Math.hypot(px - pts[0][0], py - pts[0][1]) <= pad;
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(px, py, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= pad) return true;
    }
    return false;
  }
  const b = shapeBounds(ctx, s);
  return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
}

/** Return a copy of the shape translated by (dx, dy) natural px. */
function translateShape(s: Shape, dx: number, dy: number): Shape {
  const n: Shape = { ...s };
  if (n.x != null) n.x += dx;
  if (n.y != null) n.y += dy;
  if (n.x2 != null) n.x2 += dx;
  if (n.y2 != null) n.y2 += dy;
  if (n.points) n.points = n.points.map(([px, py]) => [px + dx, py + dy]);
  return n;
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'p1' | 'p2';

interface Handle {
  id: HandleId;
  x: number;
  y: number;
}

/** The draggable resize handles for a selected shape, in natural px. */
function shapeHandles(ctx: CanvasRenderingContext2D, s: Shape): Handle[] {
  if (s.type === 'line' || s.type === 'arrow') {
    return [
      { id: 'p1', x: s.x ?? 0, y: s.y ?? 0 },
      { id: 'p2', x: s.x2 ?? s.x ?? 0, y: s.y2 ?? s.y ?? 0 },
    ];
  }
  const b = shapeBounds(ctx, s);
  const right = b.x + b.w;
  const bottom = b.y + b.h;
  const corners: Handle[] = [
    { id: 'nw', x: b.x, y: b.y },
    { id: 'ne', x: right, y: b.y },
    { id: 'sw', x: b.x, y: bottom },
    { id: 'se', x: right, y: bottom },
  ];
  // Text (font size), freehand (points), and images (aspect-locked) — corners only.
  if (s.type === 'text' || s.type === 'pencil' || s.type === 'highlighter' || s.type === 'image') return corners;
  // rect / ellipse / blur also get edge handles for one-axis resizing.
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return [
    ...corners,
    { id: 'n', x: cx, y: b.y },
    { id: 's', x: cx, y: bottom },
    { id: 'w', x: b.x, y: cy },
    { id: 'e', x: right, y: cy },
  ];
}

/** CSS cursor for a given handle. */
function handleCursor(id: HandleId): string {
  if (id === 'p1' || id === 'p2') return 'move';
  if (id === 'nw' || id === 'se') return 'nwse-resize';
  if (id === 'ne' || id === 'sw') return 'nesw-resize';
  if (id === 'n' || id === 's') return 'ns-resize';
  return 'ew-resize';
}

/** Resize a shape by dragging one of its handles to (px, py) natural px. */
function resizeShape(s: Shape, id: HandleId, px: number, py: number, ctx: CanvasRenderingContext2D): Shape {
  if (s.type === 'line' || s.type === 'arrow') {
    return id === 'p1' ? { ...s, x: px, y: py } : { ...s, x2: px, y2: py };
  }

  const b = shapeBounds(ctx, s);

  if (s.type === 'image') {
    // Corner resize, aspect-locked, anchored at the opposite corner.
    const anchorX = id.includes('w') ? b.x + b.w : b.x;
    const anchorY = id.includes('n') ? b.y + b.h : b.y;
    let nw = Math.max(8, Math.abs(px - anchorX));
    let nh = Math.max(8, Math.abs(py - anchorY));
    const aspect = (b.w || 1) / (b.h || 1);
    if (nw / aspect >= nh) nh = nw / aspect;
    else nw = nh * aspect;
    return {
      ...s,
      x: id.includes('w') ? anchorX - nw : anchorX,
      y: id.includes('n') ? anchorY - nh : anchorY,
      w: nw,
      h: nh,
    };
  }

  if (s.type === 'text') {
    // Vertical drag drives the font size; keep the left edge and the anchor edge fixed.
    const oldSize = s.size ?? 24;
    if (id === 'nw' || id === 'ne') {
      const bottom = b.y + oldSize;
      const size = Math.max(8, bottom - py);
      return { ...s, y: bottom - size, size };
    }
    return { ...s, y: b.y, size: Math.max(8, py - b.y) };
  }

  let left = b.x;
  let top = b.y;
  let right = b.x + b.w;
  let bottom = b.y + b.h;
  if (id.includes('w')) left = px;
  if (id.includes('e')) right = px;
  if (id.includes('n')) top = py;
  if (id.includes('s')) bottom = py;
  const nx = Math.min(left, right);
  const ny = Math.min(top, bottom);
  const nw = Math.max(4, Math.abs(right - left));
  const nh = Math.max(4, Math.abs(bottom - top));

  if (s.type === 'pencil' || s.type === 'highlighter') {
    const sx = nw / (b.w || 1);
    const sy = nh / (b.h || 1);
    const points = (s.points ?? []).map(([qx, qy]) => [nx + (qx - b.x) * sx, ny + (qy - b.y) * sy] as [number, number]);
    return { ...s, points };
  }

  return { ...s, x: nx, y: ny, w: nw, h: nh };
}

export default function ImageAnnotate() {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const blurRef = useRef<HTMLCanvasElement | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const draftRef = useRef<Shape | null>(null);
  const drawingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Guards against the spurious blur that fires the instant the text input
  // mounts (the placing click steals focus back to the body). We only treat a
  // blur as a real "done editing" once the input has actually been focused.
  const textReadyRef = useRef(false);
  // Active drag of an existing shape in Select mode (incremental delta).
  const dragRef = useRef<{ index: number; lastX: number; lastY: number } | null>(null);
  // Active resize of the selected shape via one of its handles.
  const resizeRef = useRef<{ index: number; handle: HandleId } | null>(null);
  // Manual double-click detection (setPointerCapture suppresses native dblclick).
  const lastClickRef = useRef<{ index: number; time: number } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [color, setColor] = useState('#ff3b30');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [rounded, setRounded] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [undone, setUndone] = useState<Shape[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // editIndex is set when re-editing an existing text shape (rename).
  const [textEdit, setTextEdit] = useState<{ nx: number; ny: number; left: number; top: number; editIndex?: number } | null>(null);
  const [textValue, setTextValue] = useState('');

  const hitTopmost = (px: number, py: number, textOnly = false): number | null => {
    const ctx = baseRef.current?.getContext('2d');
    if (!ctx) return null;
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (textOnly && shapes[i].type !== 'text') continue;
      if (shapeHit(ctx, shapes[i], px, py)) return i;
    }
    return null;
  };

  const handleHit = (shape: Shape, px: number, py: number): HandleId | null => {
    const ctx = baseRef.current?.getContext('2d');
    if (!ctx) return null;
    const hr = Math.max(8, 11 * scaleX());
    for (const h of shapeHandles(ctx, shape)) {
      if (Math.abs(px - h.x) <= hr && Math.abs(py - h.y) <= hr) return h.id;
    }
    return null;
  };

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

  const drawSelection = (ctx: CanvasRenderingContext2D) => {
    if (selectedIndex == null || selectedIndex >= shapes.length) return;
    const shape = shapes[selectedIndex];
    const sc = scaleX();
    const b = shapeBounds(ctx, shape);
    const pad = 6 * sc;
    ctx.save();
    ctx.strokeStyle = '#2563eb';
    // Dashed bounding box.
    ctx.setLineDash([10 * sc, 6 * sc]);
    ctx.lineWidth = Math.max(1, 1.5 * sc);
    ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
    // Solid resize handles.
    ctx.setLineDash([]);
    const hs = Math.max(6, 9 * sc);
    for (const h of shapeHandles(ctx, shape)) {
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 1.5 * sc);
      ctx.beginPath();
      ctx.rect(h.x - hs / 2, h.y - hs / 2, hs, hs);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  const redraw = (preview?: Shape | null) => {
    const view = viewRef.current;
    const base = baseRef.current;
    if (!view || !base) return;
    const ctx = view.getContext('2d')!;
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(base, 0, 0);
    if (preview) drawShape(ctx, preview, blurRef.current);
    else drawSelection(ctx);
  };

  // Rebuild whenever the committed shapes or selection change.
  useEffect(() => {
    if (!ready) return;
    rebuildBase();
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, ready, selectedIndex]);

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

  // If another tool handed us an image (via the annotator handoff), load it as
  // the base image on mount. No-op when nothing is pending.
  useEffect(() => {
    takePendingImage().then(pending => {
      if (pending) onDrop([new File([pending.blob], pending.name, { type: pending.blob.type })]);
    });
  }, []);

  const pointer = (e: { clientX: number; clientY: number }) => {
    const c = viewRef.current!;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!ready) return;
    const p = pointer(e);

    if (tool === 'select') {
      // A handle of the already-selected shape takes priority → start resizing.
      if (selectedIndex != null && selectedIndex < shapes.length) {
        const hid = handleHit(shapes[selectedIndex], p.x, p.y);
        if (hid) {
          resizeRef.current = { index: selectedIndex, handle: hid };
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          return;
        }
      }
      const idx = hitTopmost(p.x, p.y);
      setSelectedIndex(idx);
      if (idx == null) {
        lastClickRef.current = null;
        return;
      }
      // Second click on the same shape within 400ms → edit (rename) if it's text.
      const now = performance.now();
      const last = lastClickRef.current;
      if (last && last.index === idx && now - last.time < 400 && shapes[idx].type === 'text') {
        lastClickRef.current = null;
        const s = shapes[idx];
        const sc = scaleX();
        setTextValue(s.text ?? '');
        setTextEdit({ nx: s.x ?? 0, ny: s.y ?? 0, left: (s.x ?? 0) / sc, top: (s.y ?? 0) / sc, editIndex: idx });
        return;
      }
      lastClickRef.current = { index: idx, time: now };
      dragRef.current = { index: idx, lastX: p.x, lastY: p.y };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    setSelectedIndex(null);
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
    if (ready && tool !== 'text' && tool !== 'select') originRef.current = pointer(e);
    onDown(e);
  };
  const handleMove = (e: React.PointerEvent) => {
    // Resizing the selected shape via a handle (Select mode).
    if (resizeRef.current) {
      const p = pointer(e);
      const ctx = baseRef.current?.getContext('2d');
      if (!ctx) return;
      const { index, handle } = resizeRef.current;
      setShapes(prev => prev.map((s, i) => (i === index ? resizeShape(s, handle, p.x, p.y, ctx) : s)));
      return;
    }
    // Dragging an existing shape (Select mode).
    if (dragRef.current) {
      const p = pointer(e);
      const { index, lastX, lastY } = dragRef.current;
      const dx = p.x - lastX;
      const dy = p.y - lastY;
      dragRef.current.lastX = p.x;
      dragRef.current.lastY = p.y;
      setShapes(prev => prev.map((s, i) => (i === index ? translateShape(s, dx, dy) : s)));
      return;
    }
    // Hover feedback in Select mode: handle → resize cursor, shape → move.
    if (tool === 'select') {
      const p = pointer(e);
      let cursor = 'default';
      if (selectedIndex != null && selectedIndex < shapes.length) {
        const hid = handleHit(shapes[selectedIndex], p.x, p.y);
        if (hid) cursor = handleCursor(hid);
      }
      if (cursor === 'default' && hitTopmost(p.x, p.y) != null) cursor = 'move';
      if (viewRef.current) viewRef.current.style.cursor = cursor;
      return;
    }
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
    if (resizeRef.current) {
      resizeRef.current = null;
      return;
    }
    if (dragRef.current) {
      dragRef.current = null;
      return;
    }
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
    const newIndex = shapes.length;
    setShapes(prev => [...prev, d]);
    setUndone([]);
    // Jump to Select so the shape (including freehand strokes) can be moved or
    // resized immediately without switching tools by hand.
    setTool('select');
    setSelectedIndex(newIndex);
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
    if (textEdit) {
      const text = textValue.trim();
      if (textEdit.editIndex != null) {
        // Renaming an existing label: update its text, or drop it if cleared.
        const idx = textEdit.editIndex;
        setShapes(prev =>
          text ? prev.map((s, i) => (i === idx ? { ...s, text: textValue } : s)) : prev.filter((_, i) => i !== idx)
        );
        if (!text) setSelectedIndex(null);
        setUndone([]);
      } else if (text) {
        const size = Math.max(14, strokeWidth * scaleX() * 5);
        const newIndex = shapes.length;
        setShapes(prev => [
          ...prev,
          { type: 'text', color, width: 1, x: textEdit.nx, y: textEdit.ny, text: textValue, size },
        ]);
        setUndone([]);
        // Jump to Select so the new label can be moved/resized right away.
        setTool('select');
        setSelectedIndex(newIndex);
      }
    }
    setTextEdit(null);
    setTextValue('');
  };

  // Delete/Backspace removes the selected shape (when not editing text).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (textEdit || selectedIndex == null) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setShapes(prev => prev.filter((_, i) => i !== selectedIndex));
        setUndone([]);
        setSelectedIndex(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex, textEdit]);

  // Import an image from disk as a movable/resizable overlay shape.
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    const base = baseRef.current;
    if (!file || !file.type.startsWith('image/') || !base) return;
    const bmp = await createImageBitmap(file);
    // Default: fit within ~half the canvas, centered.
    const scale = Math.min(1, (base.width * 0.5) / bmp.width, (base.height * 0.5) / bmp.height);
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const x = Math.round((base.width - w) / 2);
    const y = Math.round((base.height - h) / 2);
    const newIndex = shapes.length;
    setShapes(prev => [...prev, { type: 'image', color: '#000000', width: 0, img: bmp, x, y, w, h }]);
    setUndone([]);
    setTool('select');
    setSelectedIndex(newIndex);
  };

  const undo = () => {
    setSelectedIndex(null);
    setShapes(prev => {
      if (!prev.length) return prev;
      setUndone(u => [...u, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  };
  const redo = () => {
    setSelectedIndex(null);
    setUndone(prev => {
      if (!prev.length) return prev;
      setShapes(s => [...s, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  };
  const clearAll = () => {
    setShapes([]);
    setUndone([]);
    setSelectedIndex(null);
  };

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo (unless editing text).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (textEdit) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // undo/redo use functional state updaters, so a stable listener is fine.
  }, [textEdit]);

  const toPngBlob = async (): Promise<Blob> => {
    const base = baseRef.current;
    if (!base) throw new Error('Nothing to export yet.');
    return await new Promise<Blob>((res, rej) =>
      base.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/png')
    );
  };

  const download = async () => {
    if (!baseRef.current) return;
    const blob = await toPngBlob();
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
              Annotate with shapes, arrows, text, highlighter, and blur · Select to move or rename
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
                onClick={() => { setTool(t); if (t !== 'select') setSelectedIndex(null); }}
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

            {/* Import an image from disk as a movable/resizable overlay. */}
            <button
              onClick={() => importInputRef.current?.click()}
              title="Import image"
              className="flex items-center gap-1.5 border-2 border-border bg-muted p-2 text-sm font-bold shadow-brutal-sm press-brutal"
            >
              <ImagePlus className="h-4 w-4" />
              Import
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="image/*"
              onChange={onImportFile}
              className="hidden"
            />

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

            <button onClick={undo} disabled={!shapes.length} title="Undo (⌘/Ctrl+Z)" aria-label="Undo" className="border-2 border-border bg-muted p-2 shadow-brutal-sm press-brutal disabled:opacity-30">
              <Undo2 className="h-4 w-4" />
            </button>
            <button onClick={redo} disabled={!undone.length} title="Redo (⌘/Ctrl+Shift+Z)" aria-label="Redo" className="border-2 border-border bg-muted p-2 shadow-brutal-sm press-brutal disabled:opacity-30">
              <Redo2 className="h-4 w-4" />
            </button>
            <button onClick={clearAll} disabled={!shapes.length} title="Clear annotations" className="border-2 border-border bg-muted p-2 shadow-brutal-sm press-brutal disabled:opacity-30">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {tool === 'select' && (
            <p className="text-xs text-muted-foreground">
              Drag to move · drag a handle to resize · double-click text to rename · Delete to remove
            </p>
          )}

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
              style={{ cursor: tool === 'text' ? 'text' : tool === 'select' ? 'default' : 'crosshair' }}
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
            <CopyImageButton blob={toPngBlob} />
            <Button variant="ghost" onClick={() => { setFile(null); setReady(false); setShapes([]); setUndone([]); }}>
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
