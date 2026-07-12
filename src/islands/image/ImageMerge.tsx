import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, X, MoveVertical, MoveHorizontal, LayoutGrid, ChevronDown } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { mergeImages, type MergeDirection } from '@/tools/image/merge.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

interface Item {
  id: string;
  file: File;
  url: string;
}

let counter = 0;

/** Google-Docs-style grid picker: hover/click a cell to choose the column count. */
function ColumnPicker({ count, columns, onChange }: { count: number; columns: number; onChange: (cols: number) => void }) {
  const [hover, setHover] = useState(0);
  const maxCols = Math.min(8, Math.max(1, count));
  const active = hover || columns;
  const maxRows = Math.min(8, Math.max(1, Math.ceil(count / 1)));
  const rowsForActive = Math.ceil(count / active);
  const gridRows = Math.min(maxRows, Math.max(rowsForActive, Math.ceil(count / maxCols)));

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Columns</span>
      <div
        className="inline-grid gap-1 border-2 border-border bg-muted p-2"
        style={{ gridTemplateColumns: `repeat(${maxCols}, 1.25rem)` }}
        onMouseLeave={() => setHover(0)}
      >
        {Array.from({ length: maxCols * gridRows }, (_, i) => {
          const c = (i % maxCols) + 1;
          const r = Math.floor(i / maxCols) + 1;
          const on = c <= active && r <= rowsForActive;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(c)}
              onFocus={() => setHover(c)}
              onClick={() => onChange(c)}
              aria-label={`${c} column${c > 1 ? 's' : ''}`}
              className={`h-5 w-5 border-2 ${on ? 'border-accent bg-accent/40' : 'border-border bg-background'}`}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {active} column{active > 1 ? 's' : ''} × {Math.ceil(count / active)} row{Math.ceil(count / active) > 1 ? 's' : ''}
      </p>
    </div>
  );
}

export default function ImageMerge() {
  const [items, setItems] = useState<Item[]>([]);
  const [direction, setDirection] = useState<MergeDirection>('vertical');
  const [gap, setGap] = useState(0);
  const [match, setMatch] = useState(true);
  const [columns, setColumns] = useState(2);
  const [pickerOpen, setPickerOpen] = useState(false);
  const directionRef = useRef<HTMLDivElement>(null);
  const [transparent, setTransparent] = useState(false);
  const [background, setBackground] = useState('#ffffff');
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { items.forEach(i => URL.revokeObjectURL(i.url)); }, [items]);

  // Close the column popover when clicking outside the Direction controls.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (directionRef.current && !directionRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [pickerOpen]);

  const addFiles = (files: File[]) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    setResult(null);
    setError('');
    setItems(prev => [...prev, ...images.map(file => ({ id: `img-${counter++}`, file, url: URL.createObjectURL(file) }))]);
  };

  usePasteImage(f => addFiles([f]));

  const move = (index: number, delta: number) => {
    setItems(prev => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const run = async () => {
    if (items.length < 2) {
      setError('Add at least two images to merge.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob } = await mergeImages(items.map(i => i.file), {
        direction,
        gap,
        match,
        columns,
        background: transparent ? 'transparent' : background,
      });
      setResult(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={addFiles} accept="image/*" multiple>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop images or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Combine multiple images into one · reorder them below · or paste (⌘V)
          </p>
        </div>
      </Dropzone>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-3 border-2 border-border bg-muted p-2">
              <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
              <img src={item.url} alt="" className="h-12 w-12 border-2 border-border bg-white object-contain" />
              <span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                title="Move up"
                className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                title="Move down"
                className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(item.id)}
                title="Remove"
                className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-end gap-4">
          <div ref={directionRef} className="space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Direction</span>
            <div className="flex gap-2">
              <Button variant={direction === 'vertical' ? 'primary' : 'secondary'} aria-pressed={direction === 'vertical'} onClick={() => { setDirection('vertical'); setPickerOpen(false); }}>
                <MoveVertical className="h-4 w-4" />
                Vertical
              </Button>
              <Button variant={direction === 'horizontal' ? 'primary' : 'secondary'} aria-pressed={direction === 'horizontal'} onClick={() => { setDirection('horizontal'); setPickerOpen(false); }}>
                <MoveHorizontal className="h-4 w-4" />
                Horizontal
              </Button>
              {/* The picker anchors to this button, dropping straight below it like a select menu. */}
              <div className="relative">
                <Button
                  variant={direction === 'grid' ? 'primary' : 'secondary'}
                  aria-pressed={direction === 'grid'}
                  aria-haspopup="grid"
                  aria-expanded={direction === 'grid' && pickerOpen}
                  onClick={() => { if (direction === 'grid') { setPickerOpen(o => !o); } else { setDirection('grid'); setPickerOpen(true); } }}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Grid
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${direction === 'grid' && pickerOpen ? 'rotate-180' : ''}`} />
                </Button>

                {direction === 'grid' && pickerOpen && (
                  <div
                    role="dialog"
                    aria-label="Choose grid columns"
                    className="absolute left-0 bottom-full z-30 mb-2 origin-bottom border-2 border-border bg-background p-3 shadow-brutal"
                    style={{ animation: 'gwtDropup 150ms ease-out' }}
                  >
                    <ColumnPicker
                      count={items.length}
                      columns={columns}
                      onChange={c => { setColumns(c); setPickerOpen(false); }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Compact summary sits under the buttons; never shifts the Gap field. */}
            {direction === 'grid' && (
              <p className="text-xs text-muted-foreground">
                {Math.min(columns, items.length)} column{Math.min(columns, items.length) > 1 ? 's' : ''} ×{' '}
                {Math.ceil(items.length / Math.min(columns, items.length || 1))} rows —{' '}
                <button type="button" onClick={() => setPickerOpen(true)} className="font-bold text-accent underline">
                  change
                </button>
              </p>
            )}
          </div>

          <label className="space-y-1.5 text-sm">
            <span className="block font-bold uppercase tracking-wide text-muted-foreground">Gap (px)</span>
            <input
              type="number"
              min={0}
              value={gap}
              onChange={e => setGap(Math.max(0, Number(e.target.value)))}
              className="w-24 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm">
            <input type="checkbox" checked={match} onChange={() => setMatch(m => !m)} className="accent-accent" />
            Match {direction === 'horizontal' ? 'heights' : 'widths'}
          </label>

          <label className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm">
            <input type="checkbox" checked={transparent} onChange={() => setTransparent(t => !t)} className="accent-accent" />
            Transparent
          </label>

          {!transparent && (
            <label className="flex items-center gap-2 text-sm" title="Background">
              <span className="text-muted-foreground">Background</span>
              <input
                type="color"
                value={background}
                onChange={e => setBackground(e.target.value)}
                className="h-9 w-10 cursor-pointer border-2 border-border bg-muted"
              />
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={items.length < 2 || busy}>
          {busy ? 'Merging…' : `Merge ${items.length || ''} images`.trim()}
        </Button>
        <Button variant="ghost" onClick={() => { setItems([]); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename="merged.png" />}
    </div>
  );
}
