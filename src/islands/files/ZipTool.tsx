import { useEffect, useState } from 'react';
import { Download, X, FileArchive } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { createZip, extractZip, type ZipEntry } from '@/tools/files/zip.lib';

type Mode = 'create' | 'extract';

let counter = 0;

export default function ZipTool() {
  const [mode, setMode] = useState<Mode>('create');
  // Create mode: files queued for zipping.
  const [items, setItems] = useState<{ id: string; file: File }[]>([]);
  // Extract mode: entries pulled out of an uploaded archive.
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [archiveName, setArchiveName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setItems([]);
    setEntries([]);
    setArchiveName('');
    setError('');
  }, [mode]);

  const addFiles = (files: File[]) => {
    setError('');
    setItems(prev => [...prev, ...files.map(file => ({ id: `f${counter++}`, file }))]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const makeZip = async () => {
    if (items.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const zipEntries: ZipEntry[] = await Promise.all(
        items.map(async ({ file }) => ({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) }))
      );
      const zipped = createZip(zipEntries);
      await downloadService.download(new Blob([zipped], { type: 'application/zip' }), 'archive.zip');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the archive.');
    } finally {
      setBusy(false);
    }
  };

  const openArchive = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setEntries([]);
    setArchiveName(file.name);
    try {
      setEntries(extractZip(new Uint8Array(await file.arrayBuffer())));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the archive.');
    } finally {
      setBusy(false);
    }
  };

  const downloadEntry = (entry: ZipEntry) => {
    const name = entry.name.split('/').pop() || entry.name;
    downloadService.download(new Blob([entry.data]), name);
  };

  const totalSize = items.reduce((sum, i) => sum + i.file.size, 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={mode === 'create' ? 'primary' : 'secondary'} aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
          <FileArchive className="h-4 w-4" />
          Create ZIP
        </Button>
        <Button variant={mode === 'extract' ? 'primary' : 'secondary'} aria-pressed={mode === 'extract'} onClick={() => setMode('extract')}>
          <Download className="h-4 w-4" />
          Extract ZIP
        </Button>
      </div>

      {mode === 'create' ? (
        <>
          <Dropzone onDrop={addFiles} multiple>
            <div className="space-y-1">
              <p className="text-lg font-bold">Drop files or click to browse</p>
              <p className="text-sm text-muted-foreground">Bundle any files into a single .zip — all in your browser</p>
            </div>
          </Dropzone>

          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map(({ id, file }) => (
                <li key={id} className="flex items-center gap-3 border-2 border-border bg-muted p-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                  <button onClick={() => removeItem(id)} title="Remove" className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={makeZip} disabled={items.length === 0 || busy}>
              {busy ? 'Zipping…' : `Create ZIP (${items.length} file${items.length === 1 ? '' : 's'})`}
            </Button>
            {items.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">{formatBytes(totalSize)} total</span>
                <Button variant="ghost" onClick={() => setItems([])}>Clear</Button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <Dropzone onDrop={openArchive} accept=".zip,application/zip,application/x-zip-compressed" multiple={false}>
            <div className="space-y-1">
              <p className="text-lg font-bold">Drop a .zip or click to browse</p>
              <p className="text-sm text-muted-foreground">List its contents and download any file</p>
            </div>
          </Dropzone>

          {archiveName && !error && (
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{archiveName}</span> — {busy ? 'reading…' : `${entries.length} file${entries.length === 1 ? '' : 's'}`}
            </p>
          )}

          {entries.length > 0 && (
            <ul className="space-y-2">
              {entries.map((entry, i) => (
                <li key={i} className="flex items-center gap-3 border-2 border-border bg-muted p-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(entry.data.length)}</span>
                  <button onClick={() => downloadEntry(entry)} title="Download" className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal">
                    <Download className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
