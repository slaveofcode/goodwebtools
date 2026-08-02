import { useEffect, useState } from 'react';
import { Download, X, FileArchive } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { createZip, extractZip, type ZipEntry } from '@/tools/files/zip.lib';
import type { Lang } from '@/i18n/config';

type Mode = 'create' | 'extract';

const TR: Record<Lang, {
  createZip: string;
  extractZip: string;
  couldNotCreate: string;
  couldNotRead: string;
  dropFiles: string;
  bundleHint: string;
  remove: string;
  zipping: string;
  createZipCount: (n: number) => string;
  total: (s: string) => string;
  clear: string;
  dropZip: string;
  listHint: string;
  reading: string;
  fileCount: (n: number) => string;
  download: string;
}> = {
  en: {
    createZip: 'Create ZIP',
    extractZip: 'Extract ZIP',
    couldNotCreate: 'Could not create the archive.',
    couldNotRead: 'Could not read the archive.',
    dropFiles: 'Drop files or click to browse',
    bundleHint: 'Bundle any files into a single .zip — all in your browser',
    remove: 'Remove',
    zipping: 'Zipping…',
    createZipCount: (n) => `Create ZIP (${n} file${n === 1 ? '' : 's'})`,
    total: (s) => `${s} total`,
    clear: 'Clear',
    dropZip: 'Drop a .zip or click to browse',
    listHint: 'List its contents and download any file',
    reading: 'reading…',
    fileCount: (n) => `${n} file${n === 1 ? '' : 's'}`,
    download: 'Download',
  },
  id: {
    createZip: 'Buat ZIP',
    extractZip: 'Ekstrak ZIP',
    couldNotCreate: 'Tidak dapat membuat arsip.',
    couldNotRead: 'Tidak dapat membaca arsip.',
    dropFiles: 'Letakkan file atau klik untuk menjelajah',
    bundleHint: 'Gabungkan file apa pun ke dalam satu .zip — semua di browser Anda',
    remove: 'Hapus',
    zipping: 'Membuat ZIP…',
    createZipCount: (n) => `Buat ZIP (${n} file)`,
    total: (s) => `${s} total`,
    clear: 'Bersihkan',
    dropZip: 'Letakkan file .zip atau klik untuk menjelajah',
    listHint: 'Tampilkan isinya dan unduh file mana pun',
    reading: 'membaca…',
    fileCount: (n) => `${n} file`,
    download: 'Unduh',
  },
};

let counter = 0;

export default function ZipTool({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
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
      setError(e instanceof Error ? e.message : t.couldNotCreate);
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
      setError(e instanceof Error ? e.message : t.couldNotRead);
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
          {t.createZip}
        </Button>
        <Button variant={mode === 'extract' ? 'primary' : 'secondary'} aria-pressed={mode === 'extract'} onClick={() => setMode('extract')}>
          <Download className="h-4 w-4" />
          {t.extractZip}
        </Button>
      </div>

      {mode === 'create' ? (
        <>
          <Dropzone onDrop={addFiles} multiple>
            <div className="space-y-1">
              <p className="text-lg font-bold">{t.dropFiles}</p>
              <p className="text-sm text-muted-foreground">{t.bundleHint}</p>
            </div>
          </Dropzone>

          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map(({ id, file }) => (
                <li key={id} className="flex items-center gap-3 border-2 border-border bg-muted p-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                  <button onClick={() => removeItem(id)} title={t.remove} className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={makeZip} disabled={items.length === 0 || busy}>
              {busy ? t.zipping : t.createZipCount(items.length)}
            </Button>
            {items.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">{t.total(formatBytes(totalSize))}</span>
                <Button variant="ghost" onClick={() => setItems([])}>{t.clear}</Button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <Dropzone onDrop={openArchive} accept=".zip,application/zip,application/x-zip-compressed" multiple={false}>
            <div className="space-y-1">
              <p className="text-lg font-bold">{t.dropZip}</p>
              <p className="text-sm text-muted-foreground">{t.listHint}</p>
            </div>
          </Dropzone>

          {archiveName && !error && (
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{archiveName}</span> — {busy ? t.reading : t.fileCount(entries.length)}
            </p>
          )}

          {entries.length > 0 && (
            <ul className="space-y-2">
              {entries.map((entry, i) => (
                <li key={i} className="flex items-center gap-3 border-2 border-border bg-muted p-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(entry.data.length)}</span>
                  <button onClick={() => downloadEntry(entry)} title={t.download} className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal">
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
