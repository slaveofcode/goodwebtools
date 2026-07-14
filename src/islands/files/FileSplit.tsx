import { useState } from 'react';
import { Download, X, ArrowUp, ArrowDown, Scissors, Combine } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { splitRanges, partName, joinedName, naturalCompare } from '@/tools/files/split.lib';

type Mode = 'split' | 'join';

interface Part {
  name: string;
  blob: Blob;
}

let counter = 0;

export default function FileSplit() {
  const [mode, setMode] = useState<Mode>('split');
  const [error, setError] = useState('');

  // Split state
  const [file, setFile] = useState<File | null>(null);
  const [chunkMB, setChunkMB] = useState(10);
  const [parts, setParts] = useState<Part[]>([]);

  // Join state
  const [pieces, setPieces] = useState<{ id: string; file: File }[]>([]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setFile(null);
    setParts([]);
    setPieces([]);
  };

  // ---- Split ----
  const onDropSplit = (files: File[]) => {
    setError('');
    setParts([]);
    setFile(files[0] ?? null);
  };

  const chunkBytes = Math.max(1, Math.round(chunkMB * 1024 * 1024));
  const partCount = file ? splitRanges(file.size, chunkBytes).length : 0;

  const doSplit = () => {
    if (!file) return;
    setError('');
    try {
      const ranges = splitRanges(file.size, chunkBytes);
      if (ranges.length <= 1) {
        setError('The part size is larger than the file — nothing to split.');
        return;
      }
      setParts(
        ranges.map(r => ({
          name: partName(file.name, r.index, ranges.length),
          blob: file.slice(r.start, r.end),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not split the file.');
    }
  };

  // ---- Join ----
  const onDropJoin = (files: File[]) => {
    setError('');
    setPieces(prev =>
      [...prev, ...files.map(f => ({ id: `p${counter++}`, file: f }))].sort((a, b) =>
        naturalCompare(a.file.name, b.file.name)
      )
    );
  };
  const move = (index: number, delta: number) =>
    setPieces(prev => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const removePiece = (id: string) => setPieces(prev => prev.filter(p => p.id !== id));

  const doJoin = async () => {
    if (pieces.length < 2) {
      setError('Add at least two parts to join.');
      return;
    }
    setError('');
    const joined = new Blob(pieces.map(p => p.file));
    await downloadService.download(joined, joinedName(pieces[0].file.name));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={mode === 'split' ? 'primary' : 'secondary'} aria-pressed={mode === 'split'} onClick={() => switchMode('split')}>
          <Scissors className="h-4 w-4" />
          Split
        </Button>
        <Button variant={mode === 'join' ? 'primary' : 'secondary'} aria-pressed={mode === 'join'} onClick={() => switchMode('join')}>
          <Combine className="h-4 w-4" />
          Join
        </Button>
      </div>

      {mode === 'split' ? (
        <>
          <Dropzone onDrop={onDropSplit} multiple={false}>
            <div className="space-y-1">
              <p className="text-lg font-bold">Drop a file or click to browse</p>
              <p className="text-sm text-muted-foreground">Cut a large file into fixed-size parts — all in your browser</p>
            </div>
          </Dropzone>

          {file && (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <label className="space-y-1.5 text-sm">
                  <span className="block font-bold uppercase tracking-wide text-muted-foreground">Part size (MB)</span>
                  <input
                    type="number"
                    min={1}
                    value={chunkMB}
                    onChange={e => { setChunkMB(Math.max(1, Number(e.target.value))); setParts([]); }}
                    className="w-28 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
                  />
                </label>
                <Button onClick={doSplit} disabled={partCount <= 1}>
                  Split into {partCount} part{partCount === 1 ? '' : 's'}
                </Button>
              </div>
            </>
          )}

          {parts.length > 0 && (
            <ul className="space-y-2">
              {parts.map((part, i) => (
                <li key={i} className="flex items-center gap-3 border-2 border-border bg-muted p-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{part.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(part.blob.size)}</span>
                  <button onClick={() => downloadService.download(part.blob, part.name)} title="Download" className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal">
                    <Download className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <Dropzone onDrop={onDropJoin} multiple>
            <div className="space-y-1">
              <p className="text-lg font-bold">Drop the parts or click to browse</p>
              <p className="text-sm text-muted-foreground">They're ordered by name automatically — reorder below if needed</p>
            </div>
          </Dropzone>

          {pieces.length > 0 && (
            <ul className="space-y-2">
              {pieces.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 border-2 border-border bg-muted p-2">
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(p.file.size)}</span>
                  <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === pieces.length - 1} title="Move down" className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button onClick={() => removePiece(p.id)} title="Remove" className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button onClick={doJoin} disabled={pieces.length < 2}>
            Join {pieces.length || ''} part{pieces.length === 1 ? '' : 's'}
          </Button>
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
