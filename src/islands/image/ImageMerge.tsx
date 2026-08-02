import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, X, MoveVertical, MoveHorizontal, LayoutGrid, ChevronDown } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { mergeImages, type MergeDirection } from '@/tools/image/merge.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

interface Item {
  id: string;
  file: File;
  url: string;
}

let counter = 0;

const TR: Record<Lang, {
  columns: string;
  colAria: (c: number) => string;
  colSummary: (cols: number, rows: number) => string;
  drop: string; dropSub: string;
  moveUp: string; moveDown: string; remove: string;
  direction: string; vertical: string; horizontal: string; grid: string;
  chooseGridColumns: string; gap: string;
  match: (horizontal: boolean) => string;
  transparent: string; background: string;
  gridSummary: (cols: number, rows: number) => string; change: string;
  merging: string; mergeBtn: (n: number) => string; clear: string;
  errMin: string; failed: string;
}> = {
  en: {
    columns: 'Columns',
    colAria: c => `${c} column${c > 1 ? 's' : ''}`,
    colSummary: (cols, rows) => `${cols} column${cols > 1 ? 's' : ''} × ${rows} row${rows > 1 ? 's' : ''}`,
    drop: 'Drop images or click to browse',
    dropSub: 'Combine multiple images into one · reorder them below · or paste (⌘V)',
    moveUp: 'Move up', moveDown: 'Move down', remove: 'Remove',
    direction: 'Direction', vertical: 'Vertical', horizontal: 'Horizontal', grid: 'Grid',
    chooseGridColumns: 'Choose grid columns', gap: 'Gap (px)',
    match: horizontal => `Match ${horizontal ? 'heights' : 'widths'}`,
    transparent: 'Transparent', background: 'Background',
    gridSummary: (cols, rows) => `${cols} column${cols > 1 ? 's' : ''} × ${rows} rows —`,
    change: 'change',
    merging: 'Merging…', mergeBtn: n => `Merge ${n || ''} images`.trim(), clear: 'Clear',
    errMin: 'Add at least two images to merge.', failed: 'Merge failed',
  },
  id: {
    columns: 'Kolom',
    colAria: c => `${c} kolom`,
    colSummary: (cols, rows) => `${cols} kolom × ${rows} baris`,
    drop: 'Letakkan gambar atau klik untuk telusuri',
    dropSub: 'Gabungkan beberapa gambar menjadi satu · atur ulang urutannya di bawah · atau tempel (⌘V)',
    moveUp: 'Naikkan', moveDown: 'Turunkan', remove: 'Hapus',
    direction: 'Arah', vertical: 'Vertikal', horizontal: 'Horizontal', grid: 'Grid',
    chooseGridColumns: 'Pilih kolom grid', gap: 'Jarak (px)',
    match: horizontal => `Samakan ${horizontal ? 'tinggi' : 'lebar'}`,
    transparent: 'Transparan', background: 'Latar belakang',
    gridSummary: (cols, rows) => `${cols} kolom × ${rows} baris —`,
    change: 'ubah',
    merging: 'Menggabungkan…', mergeBtn: n => `Gabungkan ${n || ''} gambar`.trim(), clear: 'Bersihkan',
    errMin: 'Tambahkan minimal dua gambar untuk digabungkan.', failed: 'Gagal menggabungkan',
  },
};

/** Google-Docs-style grid picker: hover/click a cell to choose the column count. */
function ColumnPicker({ count, columns, onChange, lang }: { count: number; columns: number; onChange: (cols: number) => void; lang: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [hover, setHover] = useState(0);
  const maxCols = Math.min(8, Math.max(1, count));
  const active = hover || columns;
  const maxRows = Math.min(8, Math.max(1, Math.ceil(count / 1)));
  const rowsForActive = Math.ceil(count / active);
  const gridRows = Math.min(maxRows, Math.max(rowsForActive, Math.ceil(count / maxCols)));

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.columns}</span>
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
              aria-label={t.colAria(c)}
              className={`h-5 w-5 border-2 ${on ? 'border-accent bg-accent/40' : 'border-border bg-background'}`}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {t.colSummary(active, Math.ceil(count / active))}
      </p>
    </div>
  );
}

export default function ImageMerge({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
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
      setError(t.errMin);
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
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={addFiles} accept="image/*" multiple>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">
            {t.dropSub}
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
                title={t.moveUp}
                className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                title={t.moveDown}
                className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(item.id)}
                title={t.remove}
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
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.direction}</span>
            <div className="flex gap-2">
              <Button variant={direction === 'vertical' ? 'primary' : 'secondary'} aria-pressed={direction === 'vertical'} onClick={() => { setDirection('vertical'); setPickerOpen(false); }}>
                <MoveVertical className="h-4 w-4" />
                {t.vertical}
              </Button>
              <Button variant={direction === 'horizontal' ? 'primary' : 'secondary'} aria-pressed={direction === 'horizontal'} onClick={() => { setDirection('horizontal'); setPickerOpen(false); }}>
                <MoveHorizontal className="h-4 w-4" />
                {t.horizontal}
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
                  {t.grid}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${direction === 'grid' && pickerOpen ? 'rotate-180' : ''}`} />
                </Button>

                {direction === 'grid' && pickerOpen && (
                  <div
                    role="dialog"
                    aria-label={t.chooseGridColumns}
                    className="absolute left-0 bottom-full z-30 mb-2 origin-bottom border-2 border-border bg-background p-3 shadow-brutal"
                    style={{ animation: 'gwtDropup 150ms ease-out' }}
                  >
                    <ColumnPicker
                      count={items.length}
                      columns={columns}
                      onChange={c => { setColumns(c); setPickerOpen(false); }}
                      lang={lang}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <label className="space-y-1.5 text-sm">
            <span className="block font-bold uppercase tracking-wide text-muted-foreground">{t.gap}</span>
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
            {t.match(direction === 'horizontal')}
          </label>

          <label className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm">
            <input type="checkbox" checked={transparent} onChange={() => setTransparent(t => !t)} className="accent-accent" />
            {t.transparent}
          </label>

          {!transparent && (
            <label className="flex items-center gap-2 text-sm" title={t.background}>
              <span className="text-muted-foreground">{t.background}</span>
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

      {/* Summary lives on its own line so entering grid mode never shifts the options row. */}
      {items.length > 0 && direction === 'grid' && (
        <p className="text-xs text-muted-foreground">
          {t.gridSummary(Math.min(columns, items.length), Math.ceil(items.length / Math.min(columns, items.length || 1)))}{' '}
          <button type="button" onClick={() => setPickerOpen(true)} className="font-bold text-accent underline">
            {t.change}
          </button>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={items.length < 2 || busy}>
          {busy ? t.merging : t.mergeBtn(items.length)}
        </Button>
        <Button variant="ghost" onClick={() => { setItems([]); setResult(null); setError(''); }}>
          {t.clear}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename="merged.png" />}
    </div>
  );
}
