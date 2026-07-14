import { useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';

interface Entry {
  name: string;
  size: number;
  // libarchive.js CompressedFile — extract() resolves to a browser File.
  file: { extract: () => Promise<File>; name: string; size?: number };
}

let inited = false;

/** Lazily load libarchive.js and point it at the self-hosted worker/WASM. */
async function loadArchive() {
  const { Archive } = await import('libarchive.js');
  if (!inited) {
    Archive.init({ workerUrl: '/libarchive/worker-bundle.js' });
    inited = true;
  }
  return Archive;
}

const ACCEPT =
  '.rar,.7z,.zip,.tar,.gz,.tgz,.bz2,.tbz2,.xz,.txz,.zst,.cab,.iso,.cpio,.ar,.lha';

export default function ArchiveExtract() {
  const [archiveName, setArchiveName] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setEntries([]);
    setArchiveName(file.name);
    try {
      const Archive = await loadArchive();
      const archive = await Archive.open(file);
      const arr = (await archive.getFilesArray()) as { file: Entry['file']; path: string }[];
      const mapped: Entry[] = arr
        .map(a => ({
          name: `${a.path ?? ''}${a.file.name}`,
          size: a.file.size ?? 0,
          file: a.file,
        }))
        // Hide macOS archive cruft (__MACOSX/, AppleDouble ._ files).
        .filter(e => !e.name.includes('__MACOSX/') && !(e.name.split('/').pop() || '').startsWith('._'));
      setEntries(mapped);
      if (mapped.length === 0) setError('No files found in this archive.');
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Could not read this archive. It may be corrupt, password-protected, or an unsupported format.'
      );
    } finally {
      setBusy(false);
    }
  };

  const download = async (entry: Entry) => {
    setError('');
    try {
      const extracted = await entry.file.extract();
      const name = entry.name.split('/').pop() || extracted.name || 'file';
      await downloadService.download(extracted, name);
    } catch {
      setError(`Could not extract "${entry.name}".`);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={open} accept={ACCEPT} multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an archive or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Extract RAR, 7z, TAR, GZ, ZIP and more — decoded in your browser
          </p>
        </div>
      </Dropzone>

      <p className="text-xs text-muted-foreground">
        Extract-only. Creating .rar/.7z isn't possible client-side (proprietary formats). The first
        open loads a ~1&nbsp;MB decoder, then it's cached.
      </p>

      {busy && <p className="text-sm text-muted-foreground">Reading {archiveName || 'archive'}…</p>}

      {archiveName && !busy && !error && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{archiveName}</span> — {entries.length} file
          {entries.length === 1 ? '' : 's'}
        </p>
      )}

      {entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((entry, i) => (
            <li key={i} className="flex items-center gap-3 border-2 border-border bg-muted p-2">
              <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
              {entry.size > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(entry.size)}</span>
              )}
              <button
                onClick={() => download(entry)}
                title="Download"
                className="border-2 border-border bg-muted p-1.5 shadow-brutal-sm press-brutal"
              >
                <Download className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
