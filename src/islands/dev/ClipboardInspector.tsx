import { useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Download, Trash2, RefreshCw, FileVideo, FileAudio, FileImage, FileText, File, Code } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import {
  readClipboard, parseDataTransfer, previewKindOf, formatSize, mimeToExtension, entryToBlob,
  type ClipboardSnapshot, type ClipboardItemEntry, type PreviewKind,
} from '@/tools/dev/clipboard.lib';
import { downloadService } from '@/services/download.service';
import type { Lang } from '@/i18n/config';

let _snapshotCounter = 0;

const KIND_ICON: Record<PreviewKind, React.ElementType> = {
  text: FileText,
  html: Code,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  pdf: File,
  binary: File,
};

const KIND_LABEL: Record<PreviewKind, string> = {
  text: 'Text',
  html: 'HTML',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  binary: 'Binary',
};

function TypeBadge({ kind, type }: { kind: PreviewKind; type: string }) {
  const Icon = KIND_ICON[kind];
  const colors: Record<PreviewKind, string> = {
    text:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    html:   'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    image:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    video:  'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    audio:  'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
    pdf:    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    binary: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded ${colors[kind]}`}>
      <Icon className="h-3 w-3" />
      {KIND_LABEL[kind]}
      <span className="opacity-60 font-normal">{type}</span>
    </span>
  );
}

function ItemPreview({ item }: { item: ClipboardItemEntry }) {
  const [showHtml, setShowHtml] = useState<'source' | 'render'>('render');

  async function handleDownload() {
    const ext = item.filename
      ? item.filename.split('.').pop() ?? mimeToExtension(item.type)
      : mimeToExtension(item.type);
    const name = item.filename ?? `clipboard.${ext}`;
    const blob = await entryToBlob(item);
    if (blob) downloadService.download(blob, name);
  }

  return (
    <div className="border-2 border-border bg-background">
      {/* Item header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted border-b-2 border-border">
        <div className="flex items-center gap-2 min-w-0">
          <TypeBadge kind={item.kind} type={item.type} />
          <span className="text-xs text-muted-foreground shrink-0">
            {formatSize(item.size)}
            {item.filename && <> · {item.filename}</>}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.kind === 'html' && (
            <button
              onClick={() => setShowHtml(v => v === 'render' ? 'source' : 'render')}
              className="text-xs px-2 py-1 border-2 border-border hover:bg-muted"
            >
              {showHtml === 'render' ? 'Source' : 'Render'}
            </button>
          )}
          <Button variant="secondary" onClick={handleDownload} title="Save to disk">
            <Download className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="p-3">
        {item.kind === 'text' && (
          <pre className="text-sm whitespace-pre-wrap break-all max-h-48 overflow-y-auto font-mono leading-relaxed">
            {item.text}
          </pre>
        )}

        {item.kind === 'html' && showHtml === 'render' && (
          <iframe
            srcDoc={item.text}
            sandbox=""
            className="w-full border-0 min-h-[120px] max-h-64 bg-white dark:bg-zinc-900"
            title="HTML preview"
          />
        )}
        {item.kind === 'html' && showHtml === 'source' && (
          <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto font-mono leading-relaxed text-muted-foreground">
            {item.text}
          </pre>
        )}

        {item.kind === 'image' && item.blobUrl && (
          <img src={item.blobUrl} alt="Clipboard image" className="max-w-full max-h-80 object-contain" />
        )}

        {item.kind === 'video' && item.blobUrl && (
          <video
            src={item.blobUrl}
            controls
            className="max-w-full max-h-80"
            preload="metadata"
          />
        )}

        {item.kind === 'audio' && item.blobUrl && (
          <audio src={item.blobUrl} controls className="w-full" preload="metadata" />
        )}

        {(item.kind === 'pdf' || item.kind === 'binary') && (
          <p className="text-sm text-muted-foreground">
            {item.filename ?? item.type} — {formatSize(item.size)}
            <br />
            <span className="text-xs">Use Save to download this file.</span>
          </p>
        )}
      </div>
    </div>
  );
}

function SnapshotCard({ snapshot, onRemove }: { snapshot: ClipboardSnapshot; onRemove: () => void }) {
  const time = new Date(snapshot.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  return (
    <div className="border-2 border-border space-y-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted border-b-2 border-border">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 ${
            snapshot.source === 'paste'
              ? 'bg-foreground text-background'
              : 'bg-border text-foreground'
          }`}>
            {snapshot.source === 'paste' ? 'PASTE' : 'READ'}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{time}</span>
          <span className="text-xs text-muted-foreground">
            {snapshot.items.length} item{snapshot.items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={onRemove} title="Remove" className="text-muted-foreground hover:text-foreground">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-3">
        {snapshot.items.map((item, i) => (
          <ItemPreview key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function ClipboardInspector({ lang: _lang = 'en' }: { lang?: Lang }) {
  const [snapshots, setSnapshots] = useState<ClipboardSnapshot[]>([]);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const blobUrls = useRef<Set<string>>(new Set());

  function trackUrls(items: ClipboardItemEntry[]) {
    items.forEach(i => { if (i.blobUrl) blobUrls.current.add(i.blobUrl); });
  }

  function addSnapshot(source: ClipboardSnapshot['source'], items: ClipboardItemEntry[]) {
    if (!items.length) return;
    trackUrls(items);
    const snap: ClipboardSnapshot = {
      id: String(++_snapshotCounter),
      timestamp: Date.now(),
      source,
      items,
    };
    setSnapshots(prev => [snap, ...prev]);
  }

  function removeSnapshot(id: string) {
    setSnapshots(prev => {
      const snap = prev.find(s => s.id === id);
      snap?.items.forEach(i => {
        if (i.blobUrl) { URL.revokeObjectURL(i.blobUrl); blobUrls.current.delete(i.blobUrl); }
      });
      return prev.filter(s => s.id !== id);
    });
  }

  function clearAll() {
    blobUrls.current.forEach(u => URL.revokeObjectURL(u));
    blobUrls.current.clear();
    setSnapshots([]);
  }

  async function handleRead() {
    setError('');
    setReading(true);
    try {
      const items = await readClipboard();
      if (!items.length) setError('Clipboard appears empty or no readable content was found.');
      else addSnapshot('read', items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('denied') || msg.includes('permission')) {
        setError('Clipboard access was denied. Please allow clipboard access when the browser asks.');
      } else {
        setError(`Could not read clipboard: ${msg}`);
      }
    } finally {
      setReading(false);
    }
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      e.preventDefault();
      const items = parseDataTransfer(e.clipboardData);
      if (!items.length) setError('No readable content found in this paste.');
      else { setError(''); addSnapshot('paste', items); }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  useEffect(() => {
    return () => {
      blobUrls.current.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={handleRead} disabled={reading}>
          <RefreshCw className={`h-4 w-4 ${reading ? 'animate-spin' : ''}`} />
          Read Clipboard
        </Button>
        {snapshots.length > 0 && (
          <Button variant="secondary" onClick={clearAll}>
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Paste zone hint */}
      <div className="border-2 border-dashed border-border p-4 text-center space-y-1">
        <ClipboardPaste className="h-6 w-6 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Press <kbd className="px-1.5 py-0.5 border-2 border-border font-mono text-xs">⌘V</kbd> / <kbd className="px-1.5 py-0.5 border-2 border-border font-mono text-xs">Ctrl+V</kbd> anywhere on this page</p>
        <p className="text-xs text-muted-foreground">
          Paste captures any content — including video, audio, and files copied from your file manager.
          <br />
          <strong>Read Clipboard</strong> works for text, HTML, and images without pressing paste.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Snapshots */}
      {snapshots.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No clipboard contents yet — hit <strong>Read Clipboard</strong> or press <strong>⌘V / Ctrl+V</strong>.
        </p>
      )}

      <div className="space-y-4">
        {snapshots.map(snap => (
          <SnapshotCard key={snap.id} snapshot={snap} onRemove={() => removeSnapshot(snap.id)} />
        ))}
      </div>
    </div>
  );
}
