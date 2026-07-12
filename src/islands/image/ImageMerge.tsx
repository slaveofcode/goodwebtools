import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, X, MoveVertical, MoveHorizontal } from 'lucide-react';
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

export default function ImageMerge() {
  const [items, setItems] = useState<Item[]>([]);
  const [direction, setDirection] = useState<MergeDirection>('vertical');
  const [gap, setGap] = useState(0);
  const [match, setMatch] = useState(true);
  const [transparent, setTransparent] = useState(false);
  const [background, setBackground] = useState('#ffffff');
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { items.forEach(i => URL.revokeObjectURL(i.url)); }, [items]);

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
          <div className="space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Direction</span>
            <div className="flex gap-2">
              <Button variant={direction === 'vertical' ? 'primary' : 'secondary'} aria-pressed={direction === 'vertical'} onClick={() => setDirection('vertical')}>
                <MoveVertical className="h-4 w-4" />
                Vertical
              </Button>
              <Button variant={direction === 'horizontal' ? 'primary' : 'secondary'} aria-pressed={direction === 'horizontal'} onClick={() => setDirection('horizontal')}>
                <MoveHorizontal className="h-4 w-4" />
                Horizontal
              </Button>
            </div>
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
            Match {direction === 'vertical' ? 'widths' : 'heights'}
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
