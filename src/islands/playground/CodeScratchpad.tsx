import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, X, FolderOpen, Save, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import MonacoEditor from './MonacoEditor';
import { extensionToLanguage } from '@/tools/playground/language.lib';
import { loadFiles, saveFiles, type ScratchFile } from '@/tools/playground/scratchpad.store';
import { fileService } from '@/services/file';
import { clipboardService } from '@/services/clipboard';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  fileNamePrompt: string;
  renamePrompt: string;
  couldNotOpen: string;
  copied: string;
  copy: string;
  open: string;
  save: string;
  loading: string;
  closeFile: (name: string) => string;
  newFile: string;
  unsaved: string;
  helper: ReactNode;
}> = {
  en: {
    fileNamePrompt: 'File name (extension sets the language):',
    renamePrompt: 'Rename file:',
    couldNotOpen: 'Could not open file.',
    copied: 'Copied',
    copy: 'Copy',
    open: 'Open',
    save: 'Save',
    loading: 'Loading…',
    closeFile: (name) => `Close ${name}`,
    newFile: 'New file',
    unsaved: 'Unsaved changes',
    helper: (
      <>
        Tabs autosave locally. Double-click a tab to rename. Save <kbd>⌘S</kbd>, open <kbd>⌘O</kbd>.
        Select a word, then all occurrences <kbd>⌘⇧L</kbd> (or right-click → <em>Select All Occurrences</em> if your browser grabs that key),
        select-next <kbd>⌘D</kbd>, add cursor <kbd>⌘⌥↑/↓</kbd>, move line <kbd>⌥↑/↓</kbd>, column select <kbd>⇧⌥</kbd>+drag. On-device only.
      </>
    ),
  },
  id: {
    fileNamePrompt: 'Nama file (ekstensi menentukan bahasa):',
    renamePrompt: 'Ganti nama file:',
    couldNotOpen: 'Tidak dapat membuka file.',
    copied: 'Tersalin',
    copy: 'Salin',
    open: 'Buka',
    save: 'Simpan',
    loading: 'Memuat…',
    closeFile: (name) => `Tutup ${name}`,
    newFile: 'File baru',
    unsaved: 'Perubahan belum disimpan',
    helper: (
      <>
        Tab tersimpan otomatis secara lokal. Klik dua kali tab untuk mengganti nama. Simpan <kbd>⌘S</kbd>, buka <kbd>⌘O</kbd>.
        Pilih sebuah kata, lalu semua kemunculan <kbd>⌘⇧L</kbd> (atau klik kanan → <em>Select All Occurrences</em> jika browser menangkap tombol itu),
        pilih-berikutnya <kbd>⌘D</kbd>, tambah kursor <kbd>⌘⌥↑/↓</kbd>, pindah baris <kbd>⌥↑/↓</kbd>, pilih kolom <kbd>⇧⌥</kbd>+seret. Hanya di perangkat.
      </>
    ),
  },
};

// Minimal File System Access API surface (not in every TS lib.dom), so tabs can
// stay linked to a real file on disk and save back in place — like an editor.
type FsPerm = 'granted' | 'denied' | 'prompt';
interface FsWritable { write(data: string): Promise<void>; close(): Promise<void>; }
interface FsFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
  queryPermission?(d: { mode: 'read' | 'readwrite' }): Promise<FsPerm>;
  requestPermission?(d: { mode: 'read' | 'readwrite' }): Promise<FsPerm>;
}
interface FsWindow {
  showOpenFilePicker?(o?: { multiple?: boolean }): Promise<FsFileHandle[]>;
  showSaveFilePicker?(o?: { suggestedName?: string }): Promise<FsFileHandle>;
}

async function ensureReadWrite(h: FsFileHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  if (!h.queryPermission || !h.requestPermission) return true;
  if ((await h.queryPermission(opts)) === 'granted') return true;
  return (await h.requestPermission(opts)) === 'granted';
}

async function writeToHandle(h: FsFileHandle, content: string): Promise<void> {
  const writable = await h.createWritable();
  await writable.write(content);
  await writable.close();
}

let counter = 0;
const newId = () => `f${Date.now()}-${counter++}`;

function blankFile(): ScratchFile {
  return { id: newId(), name: 'untitled.txt', language: 'plaintext', content: '' };
}

export default function CodeScratchpad({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [files, setFiles] = useState<ScratchFile[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  // Tabs linked to a file on disk (per tab id), and tabs with unsaved edits.
  const handles = useRef<Map<string, FsFileHandle>>(new Map());
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const markClean = (id: string) =>
    setDirty((d) => { if (!d.has(id)) return d; const n = new Set(d); n.delete(id); return n; });

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

  const updateActive = (content: string) => {
    setFiles((fs) => fs.map((f) => (f.id === activeId ? { ...f, content } : f)));
    setDirty((d) => (d.has(activeId) ? d : new Set(d).add(activeId)));
  };

  const addFile = () => {
    const name = prompt(t.fileNamePrompt, 'untitled.txt');
    if (name === null) return;
    const f: ScratchFile = { id: newId(), name: name || 'untitled.txt', language: extensionToLanguage(name || 'untitled.txt'), content: '' };
    setFiles((fs) => [...fs, f]);
    setActiveId(f.id);
  };

  const renameFile = (id: string) => {
    const current = files.find((f) => f.id === id);
    if (!current) return;
    const name = prompt(t.renamePrompt, current.name);
    if (name === null || !name) return;
    setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, name, language: extensionToLanguage(name) } : f)));
  };

  const closeFile = (id: string) => {
    handles.current.delete(id);
    markClean(id);
    setFiles((fs) => {
      const next = fs.filter((f) => f.id !== id);
      const result = next.length ? next : [blankFile()];
      if (id === activeId) setActiveId(result[0].id);
      return result;
    });
  };

  const openFromDisk = async () => {
    const w = window as unknown as FsWindow;
    try {
      if (w.showOpenFilePicker) {
        // Keep the handle so edits can be saved straight back to this file.
        const [handle] = await w.showOpenFilePicker({ multiple: false });
        if (!handle) return;
        const file = await handle.getFile();
        const content = await file.text();
        const id = newId();
        handles.current.set(id, handle);
        setFiles((fs) => [...fs, { id, name: file.name, language: extensionToLanguage(file.name), content }]);
        setActiveId(id);
      } else {
        // Fallback (Firefox/Safari): read-only open, no in-place save.
        const picked = await fileService.openFile({ multiple: false });
        if (picked.length === 0) return;
        const file = picked[0];
        const content = await fileService.readFile(file);
        const id = newId();
        setFiles((fs) => [...fs, { id, name: file.name, language: extensionToLanguage(file.name), content }]);
        setActiveId(id);
      }
    } catch (e) {
      const err = e as Error;
      if (err.name !== 'AbortError' && err.message !== 'No files selected') alert(t.couldNotOpen);
    }
  };

  const copyActive = async () => {
    if (!active) return;
    try {
      await clipboardService.writeText(active.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (no gesture / permission) — no-op */
    }
  };

  const saveActive = async () => {
    if (!active) return;
    const fileId = active.id;
    const w = window as unknown as FsWindow;
    try {
      const linked = handles.current.get(fileId);
      if (linked) {
        // Already tied to a file on disk → write straight back, no dialog.
        if (!(await ensureReadWrite(linked))) return;
        await writeToHandle(linked, active.content);
        markClean(fileId);
        return;
      }
      if (w.showSaveFilePicker) {
        const handle = await w.showSaveFilePicker({ suggestedName: active.name });
        await writeToHandle(handle, active.content);
        handles.current.set(fileId, handle);
        // Adopt the chosen file name (and its language) for this tab.
        if (handle.name !== active.name) {
          const nm = handle.name;
          setFiles((fs) => fs.map((f) => (f.id === fileId ? { ...f, name: nm, language: extensionToLanguage(nm) } : f)));
        }
        markClean(fileId);
      } else {
        // Fallback: plain download (can't link or rename in place).
        await fileService.saveFile(active.content, { suggestedName: active.name });
        markClean(fileId);
      }
    } catch (e) {
      const err = e as Error;
      if (err.name !== 'AbortError') console.warn('Save cancelled or failed:', err);
    }
  };

  if (!ready) return <p className="text-sm text-muted-foreground">{t.loading}</p>;

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
              <button onClick={() => setActiveId(f.id)} className="font-bold" title={dirty.has(f.id) ? t.unsaved : undefined}>
                {dirty.has(f.id) && <span aria-hidden className="mr-0.5">*</span>}{f.name}
              </button>
              <button onClick={() => closeFile(f.id)} aria-label={t.closeFile(f.name)}><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button onClick={addFile} aria-label={t.newFile} className="border-2 border-border bg-muted p-1 press-brutal"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={copyActive}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t.copied : t.copy}
          </Button>
          <Button variant="secondary" onClick={openFromDisk}><FolderOpen className="h-4 w-4" />{t.open}</Button>
          <Button variant="secondary" onClick={saveActive}><Save className="h-4 w-4" />{t.save}</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.helper}
      </p>

      {active && (
        <MonacoEditor
          key={active.id}
          value={active.content}
          language={active.language}
          onChange={updateActive}
          onSave={saveActive}
          onOpen={openFromDisk}
        />
      )}
    </div>
  );
}
