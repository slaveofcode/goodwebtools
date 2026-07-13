import { useEffect, useRef, useState } from 'react';
import { Plus, X, FolderOpen, Save, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import MonacoEditor from './MonacoEditor';
import { extensionToLanguage } from '@/tools/playground/language.lib';
import { loadFiles, saveFiles, type ScratchFile } from '@/tools/playground/scratchpad.store';
import { downloadService } from '@/services/download.service';

let counter = 0;
const newId = () => `f${Date.now()}-${counter++}`;

function blankFile(): ScratchFile {
  return { id: newId(), name: 'untitled.txt', language: 'plaintext', content: '' };
}

export default function CodeScratchpad() {
  const [files, setFiles] = useState<ScratchFile[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  // File System Access handles, kept out of IndexedDB (not structured-clonable across our store).
  const handles = useRef<Map<string, FileSystemFileHandle>>(new Map());
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // Restore persisted tabs on mount.
  useEffect(() => {
    loadFiles().then((saved) => {
      const initial = saved.length ? saved : [blankFile()];
      setFiles(initial);
      setActiveId(initial[0].id);
      setReady(true);
    });
  }, []);

  // Debounced autosave whenever files change.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { void saveFiles(files); }, 400);
    return () => clearTimeout(t);
  }, [files, ready]);

  const active = files.find((f) => f.id === activeId) ?? null;

  const updateActive = (content: string) =>
    setFiles((fs) => fs.map((f) => (f.id === activeId ? { ...f, content } : f)));

  const addFile = () => {
    const name = prompt('File name (extension sets the language):', 'untitled.txt');
    if (name === null) return;
    const f: ScratchFile = { id: newId(), name: name || 'untitled.txt', language: extensionToLanguage(name || 'untitled.txt'), content: '' };
    setFiles((fs) => [...fs, f]);
    setActiveId(f.id);
  };

  const renameFile = (id: string) => {
    const current = files.find((f) => f.id === id);
    if (!current) return;
    const name = prompt('Rename file:', current.name);
    if (name === null || !name) return;
    setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, name, language: extensionToLanguage(name) } : f)));
  };

  const closeFile = (id: string) => {
    handles.current.delete(id);
    setFiles((fs) => {
      const next = fs.filter((f) => f.id !== id);
      const result = next.length ? next : [blankFile()];
      if (id === activeId) setActiveId(result[0].id);
      return result;
    });
  };

  const openFromDisk = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as unknown as { showOpenFilePicker: (o?: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker();
        const file = await handle.getFile();
        const content = await file.text();
        const f: ScratchFile = { id: newId(), name: file.name, language: extensionToLanguage(file.name), content };
        handles.current.set(f.id, handle);
        setFiles((fs) => [...fs, f]);
        setActiveId(f.id);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') alert('Could not open file.');
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const content = await file.text();
        const f: ScratchFile = { id: newId(), name: file.name, language: extensionToLanguage(file.name), content };
        setFiles((fs) => [...fs, f]);
        setActiveId(f.id);
      };
      input.click();
    }
  };

  const copyActive = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (no gesture / permission) — no-op */
    }
  };

  const saveActive = async () => {
    if (!active) return;
    const handle = handles.current.get(active.id);
    const blob = new Blob([active.content], { type: 'text/plain' });
    if (handle) {
      const writable = await (handle as unknown as { createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }).createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
    if ('showSaveFilePicker' in window) {
      try {
        const h = await (window as unknown as { showSaveFilePicker: (o?: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({ suggestedName: active.name });
        handles.current.set(active.id, h);
        const writable = await (h as unknown as { createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }).createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await downloadService.download(blob, active.name);
  };

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {files.map((f) => (
            <div
              key={f.id}
              onDoubleClick={() => renameFile(f.id)}
              className={`flex items-center gap-1 border-2 px-2 py-1 text-sm ${f.id === activeId ? 'border-border bg-accent text-accent-foreground' : 'border-border bg-muted'}`}
            >
              <button onClick={() => setActiveId(f.id)} className="font-bold">{f.name}</button>
              <button onClick={() => closeFile(f.id)} aria-label={`Close ${f.name}`}><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button onClick={addFile} aria-label="New file" className="border-2 border-border bg-muted p-1 press-brutal"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={copyActive}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="secondary" onClick={openFromDisk}><FolderOpen className="h-4 w-4" />Open</Button>
          <Button variant="secondary" onClick={saveActive}><Save className="h-4 w-4" />Save</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Tabs autosave locally. Double-click a tab to rename. Move line <kbd>⌥↑/↓</kbd>, add cursor <kbd>⌘⌥↑/↓</kbd>,
        select-next <kbd>⌘D</kbd>, all occurrences <kbd>⌘⇧L</kbd>, column select <kbd>⇧⌥</kbd>+drag. On-device only.
      </p>

      {active && (
        <MonacoEditor
          key={active.id}
          value={active.content}
          language={active.language}
          onChange={updateActive}
        />
      )}
    </div>
  );
}
