# Playground Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Playground` tool category with two on-device dev sandboxes — a multi-file **Code Scratchpad** and a **SQLite Playground** — built on one shared, lazily-loaded, self-hosted Monaco editor.

**Architecture:** A shared Monaco engine island (self-hosted workers, no CDN) underpins both tools. The Code Scratchpad keeps files in IndexedDB and reads/writes disk via the File System Access API. The SQLite Playground runs `@sqlite.org/sqlite-wasm` in a Comlink Web Worker with an OPFS SAHPool VFS (durable, no COOP/COEP), returning result sets to a React UI with a visual grid.

**Tech Stack:** Astro 4 (static) · React 18 islands · TypeScript · Tailwind (Neo-Brutalism) · `monaco-editor` · `@sqlite.org/sqlite-wasm` · `comlink` · `idb` · Vitest.

## Global Constraints

- **No external network calls except same-origin assets.** Self-host every worker/wasm; never load Monaco or SQLite from a CDN.
- **Nothing is uploaded.** All processing is on-device.
- **Vite `worker.format: 'es'` is global** (required by mupdf/pdfjs) — every Vite-bundled worker is an ES-module worker. Monaco's workers must build/run under this; validate on the **production build** (`astro preview`), not Vite dev, which mishandles excluded wasm deps.
- **Registry-driven routing:** adding a `ToolDef` to `src/registry/tools.ts` auto-creates its `/tools/<id>` route via `src/pages/tools/[tool].astro` `getStaticPaths`. No per-tool page file.
- **Lucide icons must be imported by name** on the single import line in `tools.ts`, or the build fails with "X is not defined".
- **Every `import` of a Lucide icon that isn't already imported must be added** to that line.
- **Design:** Neo-Brutalism — `border-2 border-border`, `shadow-brutal-sm`, `bg-muted`, `text-muted-foreground`, violet `bg-accent`/`text-accent-foreground`, uppercase bold labels. Match existing islands (e.g. `src/islands/media/Screenshot.tsx`).
- **Categories:** the `Category` union lives in `src/types/tool.ts`; the ordered list + color map live in `src/registry/categories.ts`. Both must include any new category or the shell/command-palette won't render it.
- **Verification is on the production build:** `npm run build` then `npx astro preview --port <p>`, headless-checked with a temporary `puppeteer-core` (uninstall after). This is the project's established practice.
- **Dark theme signal:** `document.documentElement.classList.contains('dark')`; the class is toggled by `src/components/shell/ThemeToggle.tsx` and initialised in `src/layouts/Base.astro`.

---

## File Structure

**Pure logic (unit-tested with Vitest):**
- `src/tools/playground/language.lib.ts` — filename → Monaco language id.
- `src/tools/playground/sql.lib.ts` — `splitStatements`, `classifyStatement`.
- `src/tools/playground/result.lib.ts` — `toCsv`, `toJson` for a result set.
- `src/tools/playground/schema.lib.ts` — `quoteIdent`, `mapColumnInfo`.

**Monaco foundation:**
- `src/islands/playground/monaco-setup.ts` — one-time worker env + theme setup; re-exports `monaco`.
- `src/islands/playground/MonacoEditor.tsx` — client-only React wrapper.

**Code Scratchpad:**
- `src/islands/playground/CodeScratchpad.tsx` — the tool island.
- `src/tools/playground/scratchpad.store.ts` — IndexedDB persistence (via `idb`).

**SQLite Playground:**
- `src/tools/playground/sqlite.worker.ts` — Comlink worker wrapping sqlite-wasm + OPFS.
- `src/tools/playground/sqlite.client.ts` — typed client that wraps the worker.
- `src/islands/playground/SqlitePlayground.tsx` — the tool island (schema explorer + editor + results grid).

**Wiring / config:**
- `src/types/tool.ts` — add `'Playground'` to `Category`.
- `src/registry/categories.ts` — add `'Playground'` + color.
- `src/registry/tools.ts` — two `ToolDef` entries + icons.
- `scripts/copy-wasm.mjs` — stage `sqlite3.wasm`/`sqlite3.mjs` into `public/sqlite/`.
- `astro.config.mjs` — `optimizeDeps.exclude` the sqlite wasm module.
- `.gitignore` — ignore `public/sqlite/`.
- `README.md` — Phase 9 section.

**Shared cross-task types** (defined in `sqlite.worker.ts`, imported by client + UI):

```ts
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowsAffected: number;
  elapsedMs: number;
  kind: 'select' | 'ddl' | 'dml' | 'other'; // from classifyStatement, drives messaging
}
export interface ExecResult {
  results: QueryResult[]; // one entry per executed statement
  error?: string;         // set if a statement threw; results holds those that ran before it
}
export interface ColumnInfo { name: string; type: string; pk: boolean; notnull: boolean; }
export interface SchemaObject {
  type: 'table' | 'index' | 'view' | 'trigger';
  name: string;
  sql: string;
  columns?: ColumnInfo[]; // present for tables and views
}
export interface SqliteApi {
  init(): Promise<{ persisted: boolean }>;
  exec(sql: string): Promise<ExecResult>;
  schema(): Promise<SchemaObject[]>;
  tableRows(name: string, limit: number, offset: number): Promise<QueryResult>;
  exportDb(): Promise<Uint8Array>;
  importDb(bytes: Uint8Array): Promise<void>;
  reset(): Promise<void>;
  loadSample(): Promise<void>;
}
```

> Note: this uses `ExecResult.results[]` (one `QueryResult` per statement) rather than the spec's `QueryResult.more?` — an internally-cleaner equivalent for multi-statement scripts.

---

## Task 1: Playground category wiring

**Files:**
- Modify: `src/types/tool.ts:3`
- Modify: `src/registry/categories.ts`

**Interfaces:**
- Produces: the `'Playground'` `Category` value; the ordered `categories` list and `categoryColors` map both include it. Tasks 4 and 7 register tools under this category.

- [ ] **Step 1: Add `'Playground'` to the `Category` union**

In `src/types/tool.ts` line 3:

```ts
export type Category = 'Dev' | 'PDF' | 'Image' | 'Files' | 'Draw' | 'Media' | 'Playground';
```

- [ ] **Step 2: Add it to the ordered list and color map**

In `src/registry/categories.ts`:

```ts
import type { Category } from '@/types/tool';

export const categories: Category[] = [
  'Dev',
  'PDF',
  'Image',
  'Files',
  'Draw',
  'Media',
  'Playground'
];

export const categoryColors: Record<Category, string> = {
  Dev: 'bg-blue-500',
  PDF: 'bg-red-500',
  Image: 'bg-green-500',
  Files: 'bg-yellow-500',
  Draw: 'bg-purple-500',
  Media: 'bg-pink-500',
  Playground: 'bg-orange-500'
};
```

- [ ] **Step 3: Typecheck (the `Record<Category, ...>` proves exhaustiveness)**

Run: `npx tsc --noEmit 2>&1 | grep -E "categories|tool.ts" || echo "clean"`
Expected: `clean` (no missing-key error on `categoryColors`).

- [ ] **Step 4: Commit**

```bash
git add src/types/tool.ts src/registry/categories.ts
git commit -m "feat(playground): add Playground tool category"
```

---

## Task 2: Filename → language mapping (pure)

**Files:**
- Create: `src/tools/playground/language.lib.ts`
- Test: `src/tools/playground/language.lib.test.ts`

**Interfaces:**
- Produces: `extensionToLanguage(filename: string): string` — a Monaco language id. Consumed by Code Scratchpad (Task 3/4).

- [ ] **Step 1: Write the failing test**

`src/tools/playground/language.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extensionToLanguage } from './language.lib';

describe('extensionToLanguage', () => {
  it('maps known extensions', () => {
    expect(extensionToLanguage('app.ts')).toBe('typescript');
    expect(extensionToLanguage('data.json')).toBe('json');
    expect(extensionToLanguage('notes.md')).toBe('markdown');
    expect(extensionToLanguage('query.sql')).toBe('sql');
    expect(extensionToLanguage('main.py')).toBe('python');
    expect(extensionToLanguage('style.css')).toBe('css');
  });

  it('is case-insensitive', () => {
    expect(extensionToLanguage('APP.TS')).toBe('typescript');
  });

  it('handles dotted names by using the last segment', () => {
    expect(extensionToLanguage('archive.tar.json')).toBe('json');
  });

  it('falls back to plaintext for unknown or missing extensions', () => {
    expect(extensionToLanguage('README')).toBe('plaintext');
    expect(extensionToLanguage('weird.xyz')).toBe('plaintext');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/playground/language.lib.test.ts`
Expected: FAIL — "Failed to resolve import './language.lib'".

- [ ] **Step 3: Write the implementation**

`src/tools/playground/language.lib.ts`:

```ts
const MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'json',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', markdown: 'markdown',
  sql: 'sql',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  yaml: 'yaml', yml: 'yaml',
  xml: 'xml',
  toml: 'ini', ini: 'ini',
  txt: 'plaintext',
};

/** Monaco language id for a filename, by its extension. Unknown → 'plaintext'. */
export function extensionToLanguage(filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop()! : '';
  return MAP[ext.toLowerCase()] ?? 'plaintext';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tools/playground/language.lib.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tools/playground/language.lib.ts src/tools/playground/language.lib.test.ts
git commit -m "feat(playground): filename-to-language mapping"
```

---

## Task 3: Shared Monaco engine + minimal Code Scratchpad (validates the build risk)

This task installs Monaco, self-hosts its workers, and proves it mounts on the **production build** by shipping a minimal single-buffer scratchpad. Task 4 adds tabs/disk/persistence.

**Files:**
- Create: `src/islands/playground/monaco-setup.ts`
- Create: `src/islands/playground/MonacoEditor.tsx`
- Create: `src/islands/playground/CodeScratchpad.tsx`
- Modify: `src/registry/tools.ts` (import icon + register `code-scratchpad`)
- Modify: `package.json` (adds `monaco-editor`)

**Interfaces:**
- Consumes: `extensionToLanguage` (Task 2).
- Produces: `monaco` (re-exported), `setupMonaco()`; `MonacoEditor` React component with props `{ value, language, onChange?, onMount?, readOnly?, options? }`. Consumed by Task 4 and Task 7.

- [ ] **Step 1: Install Monaco**

Run: `npm install monaco-editor@0.52.2`
Expected: adds `monaco-editor` to dependencies.

- [ ] **Step 2: Write the Monaco setup module**

`src/islands/playground/monaco-setup.ts`:

```ts
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

let done = false;

/** One-time, idempotent Monaco setup: self-hosted workers + Neo-Brutalism themes. */
export function setupMonaco(): void {
  if (done) return;
  done = true;

  // Self-host workers (no CDN) so the no-external-requests promise holds.
  (self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      if (label === 'json') return new jsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
      if (label === 'typescript' || label === 'javascript') return new tsWorker();
      return new editorWorker();
    },
  };

  monaco.editor.defineTheme('gwt-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#faf7f0',
      'editor.foreground': '#0a0a0a',
      'editorLineNumber.foreground': '#9b9689',
      'editor.selectionBackground': '#c4b5fd',
      'editorCursor.foreground': '#7c3aed',
    },
  });
  monaco.editor.defineTheme('gwt-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0a0a0a',
      'editor.foreground': '#faf7f0',
      'editorCursor.foreground': '#a78bfa',
    },
  });
}

export function isDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

export { monaco };
```

- [ ] **Step 3: Write the React wrapper**

`src/islands/playground/MonacoEditor.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { monaco, setupMonaco, isDark } from './monaco-setup';

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  readOnly?: boolean;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  height?: string;
}

export default function MonacoEditor({
  value, language, onChange, onMount, readOnly, options, height = '60vh',
}: MonacoEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create the editor once.
  useEffect(() => {
    setupMonaco();
    const host = hostRef.current!;
    const editor = monaco.editor.create(host, {
      value,
      language,
      readOnly,
      theme: isDark() ? 'gwt-dark' : 'gwt-light',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 13,
      scrollBeyondLastLine: false,
      ...options,
    });
    editorRef.current = editor;
    const sub = editor.onDidChangeModelContent(() => onChangeRef.current?.(editor.getValue()));
    onMount?.(editor);

    // Follow the app's light/dark toggle.
    const observer = new MutationObserver(() =>
      monaco.editor.setTheme(isDark() ? 'gwt-dark' : 'gwt-light')
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => { sub.dispose(); observer.disconnect(); editor.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push external value changes into the editor without moving the cursor.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && value !== editor.getValue()) editor.setValue(value);
  }, [value]);

  // Update language when the active file/tab changes.
  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model) monaco.editor.setModelLanguage(model, language);
  }, [language]);

  return <div ref={hostRef} className="w-full border-2 border-border" style={{ height }} />;
}
```

- [ ] **Step 4: Write the minimal single-buffer scratchpad**

`src/islands/playground/CodeScratchpad.tsx` (temporary MVP; Task 4 replaces the body):

```tsx
import { useState } from 'react';
import MonacoEditor from './MonacoEditor';

export default function CodeScratchpad() {
  const [code, setCode] = useState('// Scratchpad\nconst hello = "world";\n');
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A VS Code-grade editor, fully on-device. Multi-cursor, move/copy line, column select — all native.
      </p>
      <MonacoEditor value={code} language="typescript" onChange={setCode} />
    </div>
  );
}
```

- [ ] **Step 5: Register the tool**

In `src/registry/tools.ts`, add `Code2` to the Lucide import line, then add this entry (place it before the `whiteboard` entry):

```ts
  {
    id: 'code-scratchpad',
    name: 'Code Scratchpad',
    category: 'Playground',
    route: '/tools/code-scratchpad',
    keywords: ['code', 'editor', 'monaco', 'vscode', 'scratchpad', 'text', 'multi-cursor'],
    icon: Code2,
    summary: 'VS Code-grade multi-file editor, on-device',
    load: () => import('@/islands/playground/CodeScratchpad'),
    status: 'stable'
  },
```

- [ ] **Step 6: Exclude Monaco from Vite pre-bundling issues is NOT needed — build and verify the worker-format risk**

Run: `npm run build 2>&1 | tail -3`
Expected: `[build] Complete!` with the page count increased by 1. If the build errors on a worker, see the fallback note at the end of this task.

- [ ] **Step 7: Headless-verify Monaco mounts and its worker responds on the production build**

Run:

```bash
npx astro preview --port 4350 > /tmp/pv.log 2>&1 &
sleep 4
npm install -D puppeteer-core --legacy-peer-deps >/dev/null 2>&1
cat > /tmp/mcheck.mjs << 'EOF'
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
let errs=[]; p.on('pageerror', e=>errs.push(e.message.slice(0,140)));
await p.goto('http://localhost:4350/tools/code-scratchpad',{waitUntil:'networkidle2',timeout:30000});
await new Promise(r=>setTimeout(r,1500));
const mounted = await p.evaluate(()=>!!document.querySelector('.monaco-editor .view-lines'));
// Type into the editor and confirm the model updates (proves the editor is live).
await p.evaluate(()=>{ const el=document.querySelector('.monaco-editor textarea'); el && el.focus(); });
await p.keyboard.type('const x = 42;');
await new Promise(r=>setTimeout(r,300));
const hasText = await p.evaluate(()=>document.querySelector('.monaco-editor')?.textContent?.includes('42'));
console.log('monaco mounted:', mounted, '| edit works:', !!hasText, '| pageerrors:', errs.length?errs.join(';'):'none');
await b.close();
EOF
node /tmp/mcheck.mjs
kill %1 2>/dev/null
npm uninstall puppeteer-core --legacy-peer-deps >/dev/null 2>&1
```

Expected: `monaco mounted: true | edit works: true | pageerrors: none`.

- [ ] **Step 8: Commit**

```bash
git add src/islands/playground/ src/registry/tools.ts package.json package-lock.json
git commit -m "feat(playground): shared Monaco engine + minimal Code Scratchpad"
```

> **If Step 6/7 fails on the worker** (module-worker vs classic, mirroring the ffmpeg core issue): keep the `?worker` imports but instantiate the base worker from a URL instead — replace the `getWorker` body's fallback with `new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker?worker&url', import.meta.url), { type: 'module' })`, and if module workers still fail, add `vite-plugin-monaco-editor-esm` to `astro.config.mjs`'s `vite.plugins`. Re-run Steps 6–7 until green before committing.

---

## Task 4: Code Scratchpad — tabs, disk I/O, IndexedDB autosave

**Files:**
- Create: `src/tools/playground/scratchpad.store.ts`
- Modify: `src/islands/playground/CodeScratchpad.tsx` (full replacement)
- Modify: `package.json` (adds `idb`)

**Interfaces:**
- Consumes: `MonacoEditor` (Task 3), `extensionToLanguage` (Task 2), `downloadService` from `@/services/download.service`.
- Produces: the finished Code Scratchpad. `scratchpad.store.ts` exports `loadFiles(): Promise<ScratchFile[]>`, `saveFiles(files: ScratchFile[]): Promise<void>`, and the `ScratchFile` type.

- [ ] **Step 1: Install `idb`**

Run: `npm install idb@8.0.0`
Expected: adds `idb` to dependencies.

- [ ] **Step 2: Write the IndexedDB store**

`src/tools/playground/scratchpad.store.ts`:

```ts
import { openDB, type IDBPDatabase } from 'idb';

export interface ScratchFile {
  id: string;
  name: string;
  language: string;
  content: string;
}

const DB_NAME = 'gwt-scratchpad';
const STORE = 'files';

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadFiles(): Promise<ScratchFile[]> {
  return (await db()).getAll(STORE) as Promise<ScratchFile[]>;
}

export async function saveFiles(files: ScratchFile[]): Promise<void> {
  const database = await db();
  const tx = database.transaction(STORE, 'readwrite');
  await tx.objectStore(STORE).clear();
  for (const f of files) await tx.objectStore(STORE).put(f);
  await tx.done;
}
```

- [ ] **Step 3: Replace the scratchpad island with the full version**

`src/islands/playground/CodeScratchpad.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Plus, X, FolderOpen, Save } from 'lucide-react';
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
```

- [ ] **Step 4: Build**

Run: `npm run build 2>&1 | tail -2`
Expected: `[build] Complete!`.

- [ ] **Step 5: Headless-verify tabs + persistence across reload**

Run:

```bash
npx astro preview --port 4351 > /tmp/pv.log 2>&1 &
sleep 4
npm install -D puppeteer-core --legacy-peer-deps >/dev/null 2>&1
cat > /tmp/scheck.mjs << 'EOF'
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://localhost:4351/tools/code-scratchpad',{waitUntil:'networkidle2',timeout:30000});
await new Promise(r=>setTimeout(r,1200));
await p.evaluate(()=>{ const el=document.querySelector('.monaco-editor textarea'); el && el.focus(); });
await p.keyboard.type('persist me');
await new Promise(r=>setTimeout(r,700)); // allow the 400ms autosave debounce
await p.reload({waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,1200));
const restored = await p.evaluate(()=>document.querySelector('.monaco-editor')?.textContent?.includes('persist me'));
console.log('scratchpad persists across reload:', !!restored);
await b.close();
EOF
node /tmp/scheck.mjs
kill %1 2>/dev/null
npm uninstall puppeteer-core --legacy-peer-deps >/dev/null 2>&1
```

Expected: `scratchpad persists across reload: true`.

- [ ] **Step 6: Commit**

```bash
git add src/islands/playground/CodeScratchpad.tsx src/tools/playground/scratchpad.store.ts package.json package-lock.json
git commit -m "feat(playground): Code Scratchpad tabs, disk I/O, autosave"
```

---

## Task 5: SQLite pure logic libs

**Files:**
- Create: `src/tools/playground/sql.lib.ts` + `src/tools/playground/sql.lib.test.ts`
- Create: `src/tools/playground/result.lib.ts` + `src/tools/playground/result.lib.test.ts`
- Create: `src/tools/playground/schema.lib.ts` + `src/tools/playground/schema.lib.test.ts`

**Interfaces:**
- Produces:
  - `splitStatements(sql: string): string[]`
  - `classifyStatement(sql: string): 'select' | 'ddl' | 'dml' | 'other'`
  - `toCsv(result: QueryResult): string`, `toJson(result: QueryResult): string`
  - `quoteIdent(name: string): string`, `mapColumnInfo(rows: RawPragmaRow[]): ColumnInfo[]`
- Consumed by the SQLite worker (Task 6) and UI (Task 7). `QueryResult`/`ColumnInfo` are imported from `sqlite.worker.ts` (Task 6) — but to keep these libs test-independent, they define their own minimal structural types (below) that match those shapes.

- [ ] **Step 1: Write failing tests for `sql.lib`**

`src/tools/playground/sql.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { splitStatements, classifyStatement } from './sql.lib';

describe('splitStatements', () => {
  it('splits on semicolons', () => {
    expect(splitStatements('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
  });
  it('ignores semicolons inside string literals', () => {
    expect(splitStatements("INSERT INTO t VALUES ('a;b'); SELECT 1")).toEqual([
      "INSERT INTO t VALUES ('a;b')",
      'SELECT 1',
    ]);
  });
  it('ignores semicolons in line and block comments', () => {
    expect(splitStatements('SELECT 1; -- a;b\nSELECT 2; /* c;d */ SELECT 3')).toEqual([
      'SELECT 1',
      '-- a;b\nSELECT 2',
      '/* c;d */ SELECT 3',
    ]);
  });
  it('drops trailing empty statements', () => {
    expect(splitStatements('SELECT 1;   ;')).toEqual(['SELECT 1']);
  });
});

describe('classifyStatement', () => {
  it('classifies by leading keyword, skipping comments', () => {
    expect(classifyStatement('  -- hi\n SELECT * FROM t')).toBe('select');
    expect(classifyStatement('WITH x AS (SELECT 1) SELECT * FROM x')).toBe('select');
    expect(classifyStatement('PRAGMA table_info(t)')).toBe('select');
    expect(classifyStatement('CREATE TABLE t (a)')).toBe('ddl');
    expect(classifyStatement('DROP TABLE t')).toBe('ddl');
    expect(classifyStatement('INSERT INTO t VALUES (1)')).toBe('dml');
    expect(classifyStatement('UPDATE t SET a=1')).toBe('dml');
    expect(classifyStatement('BEGIN')).toBe('other');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tools/playground/sql.lib.test.ts`
Expected: FAIL — cannot resolve `./sql.lib`.

- [ ] **Step 3: Implement `sql.lib`**

`src/tools/playground/sql.lib.ts`:

```ts
/**
 * Split a multi-statement SQL script on top-level semicolons, respecting single
 * ('), double (") and backtick (`) quoted spans, `--` line comments and
 * `/* *​/` block comments. Returns trimmed, non-empty statements.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];
    // Line comment
    if (c === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }
    // Block comment
    if (c === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }
    // Quoted span
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === c) {
          if (sql[j + 1] === c) { j += 2; continue; } // doubled = escaped
          break;
        }
        j++;
      }
      buf += sql.slice(i, Math.min(j + 1, n));
      i = j + 1;
      continue;
    }
    if (c === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const LEADING_COMMENTS = /^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/;

export function classifyStatement(sql: string): 'select' | 'ddl' | 'dml' | 'other' {
  const cleaned = sql.replace(LEADING_COMMENTS, '');
  const kw = (cleaned.match(/^\s*([a-zA-Z]+)/)?.[1] ?? '').toUpperCase();
  if (kw === 'SELECT' || kw === 'WITH' || kw === 'PRAGMA' || kw === 'EXPLAIN' || kw === 'VALUES') return 'select';
  if (kw === 'CREATE' || kw === 'ALTER' || kw === 'DROP' || kw === 'REINDEX') return 'ddl';
  if (kw === 'INSERT' || kw === 'UPDATE' || kw === 'DELETE' || kw === 'REPLACE') return 'dml';
  return 'other';
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tools/playground/sql.lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing tests for `result.lib`**

`src/tools/playground/result.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toCsv, toJson } from './result.lib';

const result = {
  columns: ['id', 'name'],
  rows: [[1, 'Ann'], [2, 'B,x']],
  rowsAffected: 0,
  elapsedMs: 1,
};

describe('toCsv', () => {
  it('renders a header and quotes fields with commas', () => {
    expect(toCsv(result)).toBe('id,name\n1,Ann\n2,"B,x"');
  });
  it('escapes embedded quotes and nulls', () => {
    expect(toCsv({ columns: ['a'], rows: [['he"llo'], [null]], rowsAffected: 0, elapsedMs: 0 }))
      .toBe('a\n"he""llo"\n');
  });
});

describe('toJson', () => {
  it('maps columns to values per row', () => {
    expect(JSON.parse(toJson(result))).toEqual([
      { id: 1, name: 'Ann' },
      { id: 2, name: 'B,x' },
    ]);
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/tools/playground/result.lib.test.ts`
Expected: FAIL — cannot resolve `./result.lib`.

- [ ] **Step 7: Implement `result.lib`**

`src/tools/playground/result.lib.ts`:

```ts
interface ResultLike {
  columns: string[];
  rows: unknown[][];
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(result: ResultLike): string {
  const header = result.columns.map(cell).join(',');
  const body = result.rows.map((r) => r.map(cell).join(',')).join('\n');
  return body ? `${header}\n${body}` : header;
}

export function toJson(result: ResultLike): string {
  const objects = result.rows.map((row) => {
    const o: Record<string, unknown> = {};
    result.columns.forEach((c, i) => { o[c] = row[i] ?? null; });
    return o;
  });
  return JSON.stringify(objects, null, 2);
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run src/tools/playground/result.lib.test.ts`
Expected: PASS.

- [ ] **Step 9: Write failing tests for `schema.lib`**

`src/tools/playground/schema.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { quoteIdent, mapColumnInfo } from './schema.lib';

describe('quoteIdent', () => {
  it('wraps in double quotes and escapes embedded quotes', () => {
    expect(quoteIdent('users')).toBe('"users"');
    expect(quoteIdent('we"ird')).toBe('"we""ird"');
  });
});

describe('mapColumnInfo', () => {
  it('maps PRAGMA table_info rows to ColumnInfo', () => {
    const rows = [
      { name: 'id', type: 'INTEGER', notnull: 1, pk: 1 },
      { name: 'email', type: 'TEXT', notnull: 0, pk: 0 },
    ];
    expect(mapColumnInfo(rows)).toEqual([
      { name: 'id', type: 'INTEGER', pk: true, notnull: true },
      { name: 'email', type: 'TEXT', pk: false, notnull: false },
    ]);
  });
});
```

- [ ] **Step 10: Run to verify failure**

Run: `npx vitest run src/tools/playground/schema.lib.test.ts`
Expected: FAIL — cannot resolve `./schema.lib`.

- [ ] **Step 11: Implement `schema.lib`**

`src/tools/playground/schema.lib.ts`:

```ts
export interface RawPragmaRow {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}
export interface ColumnInfo {
  name: string;
  type: string;
  pk: boolean;
  notnull: boolean;
}

/** SQLite-safe double-quoted identifier. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function mapColumnInfo(rows: RawPragmaRow[]): ColumnInfo[] {
  return rows.map((r) => ({
    name: r.name,
    type: r.type,
    pk: !!r.pk,
    notnull: !!r.notnull,
  }));
}
```

- [ ] **Step 12: Run to verify pass, then run the whole suite**

Run: `npx vitest run src/tools/playground/`
Expected: PASS (all three lib test files).
Run: `npx vitest run 2>&1 | grep -E "Test Files|Tests "`
Expected: totals increased; all pass.

- [ ] **Step 13: Commit**

```bash
git add src/tools/playground/sql.lib.ts src/tools/playground/sql.lib.test.ts src/tools/playground/result.lib.ts src/tools/playground/result.lib.test.ts src/tools/playground/schema.lib.ts src/tools/playground/schema.lib.test.ts
git commit -m "feat(playground): SQLite pure logic libs (split/classify/serialize/schema)"
```

---

## Task 6: SQLite worker + client (sqlite-wasm + OPFS)

**Files:**
- Create: `src/tools/playground/sqlite.worker.ts`
- Create: `src/tools/playground/sqlite.client.ts`
- Modify: `scripts/copy-wasm.mjs` (stage sqlite wasm to `public/sqlite/`)
- Modify: `astro.config.mjs` (`optimizeDeps.exclude`)
- Modify: `.gitignore` (`public/sqlite/`)
- Modify: `package.json` (adds `@sqlite.org/sqlite-wasm`)

**Interfaces:**
- Consumes: `splitStatements`, `classifyStatement` (Task 5), `quoteIdent`, `mapColumnInfo` (Task 5).
- Produces: `SqliteApi` (see shared types), and `sqlite.client.ts` exporting `getSqlite(): Remote<SqliteApi>` (a Comlink-wrapped singleton). Consumed by Task 7.

- [ ] **Step 1: Install sqlite-wasm**

Run: `npm install @sqlite.org/sqlite-wasm@3.50.1-build1`
Expected: adds the dependency. (If that exact version is unavailable, use the latest `3.x` `@sqlite.org/sqlite-wasm`; the API used below is stable across 3.x.)

- [ ] **Step 2: Stage the wasm into `public/sqlite/`**

Append to `scripts/copy-wasm.mjs` (before the final `console.log`):

```js
// SQLite WASM (served same-origin at /sqlite/; loaded by the sqlite.worker).
const sqliteSrc = 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm';
if (existsSync(sqliteSrc)) {
  mkdirSync('public/sqlite', { recursive: true });
  for (const f of ['sqlite3.wasm', 'sqlite3.mjs']) {
    if (existsSync(`${sqliteSrc}/${f}`)) copyFileSync(`${sqliteSrc}/${f}`, `public/sqlite/${f}`);
  }
}
```

- [ ] **Step 3: Stage now and confirm the files exist**

Run:
```bash
node scripts/copy-wasm.mjs
ls -la public/sqlite/
```
Expected: `sqlite3.wasm` (~1 MB) and `sqlite3.mjs` present.

- [ ] **Step 4: Gitignore the staged assets**

Add to `.gitignore`:
```
public/sqlite/
```

- [ ] **Step 5: Exclude sqlite-wasm from Vite pre-bundling**

In `astro.config.mjs`, add `'@sqlite.org/sqlite-wasm'` to the `optimizeDeps.exclude` array (the line that already lists `onnxruntime-web`, `@ffmpeg/ffmpeg`, `@ffmpeg/util`):

```js
      exclude: ['pdfjs-dist/build/pdf.worker.min.mjs', 'mupdf', 'libarchive.js', 'onnxruntime-web', '@ffmpeg/ffmpeg', '@ffmpeg/util', '@sqlite.org/sqlite-wasm'],
```

- [ ] **Step 6: Write the worker**

`src/tools/playground/sqlite.worker.ts`:

```ts
import * as Comlink from 'comlink';
import { splitStatements, classifyStatement } from './sql.lib';
import { quoteIdent, mapColumnInfo, type RawPragmaRow } from './schema.lib';

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowsAffected: number;
  elapsedMs: number;
  kind: 'select' | 'ddl' | 'dml' | 'other';
}
export interface ExecResult {
  results: QueryResult[];
  error?: string;
}
export interface ColumnInfo { name: string; type: string; pk: boolean; notnull: boolean; }
export interface SchemaObject {
  type: 'table' | 'index' | 'view' | 'trigger';
  name: string;
  sql: string;
  columns?: ColumnInfo[];
}
export interface SqliteApi {
  init(): Promise<{ persisted: boolean }>;
  exec(sql: string): Promise<ExecResult>;
  schema(): Promise<SchemaObject[]>;
  tableRows(name: string, limit: number, offset: number): Promise<QueryResult>;
  exportDb(): Promise<Uint8Array>;
  importDb(bytes: Uint8Array): Promise<void>;
  reset(): Promise<void>;
  loadSample(): Promise<void>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const DB_PATH = '/playground.sqlite';
const SAMPLE = `
CREATE TABLE artists (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE albums (id INTEGER PRIMARY KEY, title TEXT NOT NULL, artist_id INTEGER REFERENCES artists(id), year INTEGER);
CREATE INDEX idx_albums_artist ON albums(artist_id);
INSERT INTO artists (id, name) VALUES (1,'Radiohead'),(2,'Miles Davis'),(3,'Aphex Twin');
INSERT INTO albums (title, artist_id, year) VALUES
 ('OK Computer',1,1997),('In Rainbows',1,2007),
 ('Kind of Blue',2,1959),('Bitches Brew',2,1970),
 ('Selected Ambient Works 85-92',3,1992);
`;

let sqlite3: any = null;
let pool: any = null;
let db: any = null;
let persisted = false;

async function ensure(): Promise<void> {
  if (db) return;
  const mod = await import('@sqlite.org/sqlite-wasm');
  const init = (mod as any).default;
  sqlite3 = await init({ locateFile: () => new URL('/sqlite/sqlite3.wasm', location.origin).href });
  try {
    pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'gwt-playground' });
    db = new pool.OpfsSAHPoolDb(DB_PATH);
    persisted = true;
  } catch {
    // OPFS SAHPool unavailable (older Safari) — fall back to in-memory.
    db = new sqlite3.oo1.DB(':memory:', 'c');
    persisted = false;
  }
}

/** Run one statement, capturing columns/rows/affected/kind. */
function runOne(sql: string): QueryResult {
  const columns: string[] = [];
  const rows: unknown[][] = [];
  const t0 = performance.now();
  db.exec({ sql, rowMode: 'array', columnNames: columns, resultRows: rows });
  const elapsedMs = performance.now() - t0;
  const rowsAffected = db.changes();
  return { columns: columns.slice(), rows, rowsAffected, elapsedMs, kind: classifyStatement(sql) };
}

const api: SqliteApi = {
  async init() {
    await ensure();
    return { persisted };
  },

  async exec(sql: string): Promise<ExecResult> {
    await ensure();
    const results: QueryResult[] = [];
    for (const stmt of splitStatements(sql)) {
      try {
        results.push(runOne(stmt));
      } catch (e) {
        return { results, error: (e as Error).message };
      }
    }
    return { results };
  },

  async schema(): Promise<SchemaObject[]> {
    await ensure();
    const master: any[] = [];
    db.exec({
      sql: "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name",
      rowMode: 'object',
      resultRows: master,
    });
    const objects: SchemaObject[] = [];
    for (const r of master) {
      const obj: SchemaObject = { type: r.type, name: r.name, sql: r.sql || '' };
      if (r.type === 'table' || r.type === 'view') {
        const info: RawPragmaRow[] = [];
        db.exec({ sql: `PRAGMA table_info(${quoteIdent(r.name)})`, rowMode: 'object', resultRows: info });
        obj.columns = mapColumnInfo(info);
      }
      objects.push(obj);
    }
    return objects;
  },

  async tableRows(name: string, limit: number, offset: number): Promise<QueryResult> {
    await ensure();
    return runOne(`SELECT * FROM ${quoteIdent(name)} LIMIT ${Math.max(0, limit)} OFFSET ${Math.max(0, offset)}`);
  },

  async exportDb(): Promise<Uint8Array> {
    await ensure();
    return sqlite3.capi.sqlite3_js_db_export(db);
  },

  async importDb(bytes: Uint8Array): Promise<void> {
    await ensure();
    db.close();
    if (pool) {
      await pool.importDb(DB_PATH, bytes);
      db = new pool.OpfsSAHPoolDb(DB_PATH);
    } else {
      db = new sqlite3.oo1.DB(':memory:', 'c');
      const p = sqlite3.wasm.allocFromTypedArray(bytes);
      sqlite3.capi.sqlite3_deserialize(db, 'main', p, bytes.length, bytes.length, sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE);
    }
  },

  async reset(): Promise<void> {
    await ensure();
    const tables: any[] = [];
    db.exec({
      sql: "SELECT type,name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
      rowMode: 'object',
      resultRows: tables,
    });
    // Drop views/triggers/indexes first, then tables.
    for (const order of ['trigger', 'view', 'index', 'table']) {
      for (const t of tables.filter((x) => x.type === order)) {
        db.exec(`DROP ${order.toUpperCase()} IF EXISTS ${quoteIdent(t.name)}`);
      }
    }
  },

  async loadSample(): Promise<void> {
    await ensure();
    await this.reset();
    db.exec(SAMPLE);
  },
};

Comlink.expose(api);
```

- [ ] **Step 7: Write the client**

`src/tools/playground/sqlite.client.ts`:

```ts
import * as Comlink from 'comlink';
import type { Remote } from 'comlink';
import type { SqliteApi } from './sqlite.worker';
import SqliteWorker from './sqlite.worker?worker';

let remote: Remote<SqliteApi> | null = null;

/** Comlink-wrapped SQLite engine, created once per session. */
export function getSqlite(): Remote<SqliteApi> {
  if (!remote) {
    const worker = new SqliteWorker();
    worker.addEventListener('error', (e) => console.error('[sqlite worker]', e.message));
    remote = Comlink.wrap<SqliteApi>(worker);
  }
  return remote;
}
```

- [ ] **Step 8: Build**

Run: `npm run build 2>&1 | tail -2`
Expected: `[build] Complete!`.

- [ ] **Step 9: Typecheck the worker + client (runtime is verified in Task 7)**

There is no UI yet, and a production preview doesn't serve `/src` modules to probe the worker directly, so the engine's **runtime** verification is folded into Task 7 Step 5 (which drives the identical client → worker → sqlite-wasm → OPFS path through the real UI). Here, prove the types and module graph resolve:

Run: `npx tsc --noEmit 2>&1 | grep -E "playground/sqlite" || echo "clean"`
Expected: `clean` (no type errors in `sqlite.worker.ts` / `sqlite.client.ts`).

Run: `npm run build 2>&1 | tail -2`
Expected: `[build] Complete!` — confirms the `?worker` import and sqlite-wasm exclusion bundle without error.

- [ ] **Step 10: Commit**

```bash
git add src/tools/playground/sqlite.worker.ts src/tools/playground/sqlite.client.ts scripts/copy-wasm.mjs astro.config.mjs .gitignore package.json package-lock.json
git commit -m "feat(playground): SQLite worker + client (sqlite-wasm + OPFS SAHPool)"
```

---

## Task 7: SQLite Playground UI

**Files:**
- Create: `src/islands/playground/SqlitePlayground.tsx`
- Modify: `src/registry/tools.ts` (import icon + register `sqlite-playground`)

**Interfaces:**
- Consumes: `getSqlite` (Task 6), `MonacoEditor` (Task 3), `classifyStatement` (Task 5), `toCsv`/`toJson` (Task 5), `downloadService`.
- Produces: the finished tool.

- [ ] **Step 1: Write the island**

`src/islands/playground/SqlitePlayground.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Play, Database, Download, Upload, FlaskConical, RotateCcw, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import MonacoEditor from './MonacoEditor';
import { getSqlite } from '@/tools/playground/sqlite.client';
import { toCsv, toJson } from '@/tools/playground/result.lib';
import { downloadService } from '@/services/download.service';
import type { monaco } from './monaco-setup';
import type { QueryResult, SchemaObject } from '@/tools/playground/sqlite.worker';

const STARTER = 'SELECT name FROM sqlite_master;\n';

export default function SqlitePlayground() {
  const [sql, setSql] = useState(STARTER);
  const [schema, setSchema] = useState<SchemaObject[]>([]);
  const [grids, setGrids] = useState<QueryResult[]>([]);
  const [activeGrid, setActiveGrid] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const db = getSqlite();

  const refreshSchema = async () => setSchema(await db.schema());

  useEffect(() => {
    db.init().then((r) => { setPersisted(r.persisted); return refreshSchema(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (only?: string) => {
    const script = only ?? (editorRef.current?.getModel()?.getValueInRange(editorRef.current.getSelection()!) || sql);
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await db.exec(script);
      // Grids = statements that returned columns (SELECT/PRAGMA); the rest are
      // DDL/DML and get a text summary built from each result's `kind`.
      const withRows = res.results.filter((r) => r.columns.length > 0);
      const noRows = res.results.filter((r) => r.columns.length === 0);
      setGrids(withRows);
      setActiveGrid(0);
      const totalMs = res.results.reduce((s, r) => s + r.elapsedMs, 0).toFixed(1);
      if (noRows.length) {
        const ddl = noRows.filter((r) => r.kind === 'ddl').length;
        const affected = noRows.filter((r) => r.kind === 'dml').reduce((s, r) => s + r.rowsAffected, 0);
        const parts: string[] = [];
        if (ddl) parts.push(`${ddl} schema change(s)`);
        if (noRows.some((r) => r.kind === 'dml')) parts.push(`${affected} row(s) affected`);
        setMessage(`${parts.join(' · ') || 'ok'} · ${totalMs} ms`);
      } else if (withRows.length) {
        setMessage(`${withRows[0].rows.length} row(s) · ${totalMs} ms`);
      }
      if (res.error) setError(res.error);
      await refreshSchema();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed.');
    } finally {
      setBusy(false);
    }
  };

  const browseTable = async (name: string) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await db.tableRows(name, 200, 0);
      setGrids([r]); setActiveGrid(0);
      setMessage(`${name}: first ${r.rows.length} row(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read table.');
    } finally {
      setBusy(false);
    }
  };

  const onMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    // Cmd/Ctrl+Enter runs the script (or selection).
    editor.addAction({
      id: 'gwt-run-sql',
      label: 'Run SQL',
      keybindings: [/* CtrlCmd */ 2048 | /* Enter */ 3],
      run: () => { void run(); },
    });
  };

  const exportDb = async () => {
    const bytes = await db.exportDb();
    await downloadService.download(new Blob([bytes], { type: 'application/x-sqlite3' }), 'playground.sqlite');
  };

  const importDb = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sqlite,.db,.sqlite3';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        await db.importDb(new Uint8Array(await file.arrayBuffer()));
        await refreshSchema();
        setMessage(`Imported ${file.name}`);
        setGrids([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not import database.');
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  const loadSample = async () => {
    setBusy(true);
    await db.loadSample();
    await refreshSchema();
    setSql('SELECT a.name AS artist, al.title, al.year\nFROM albums al JOIN artists a ON a.id = al.artist_id\nORDER BY al.year;\n');
    setMessage('Sample database loaded.');
    setBusy(false);
  };

  const resetDb = async () => {
    if (!confirm('Drop all tables in the playground database?')) return;
    setBusy(true);
    await db.reset();
    await refreshSchema();
    setGrids([]); setMessage('Database reset.');
    setBusy(false);
  };

  const grid = grids[activeGrid];

  return (
    <div className="space-y-3">
      {!persisted && (
        <Alert variant="warning">
          Your browser can&apos;t persist this database (no OPFS). It lives in memory — <b>export to keep your data</b>.
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run()} disabled={busy}><Play className="h-4 w-4" />Run (⌘⏎)</Button>
        <Button variant="secondary" onClick={loadSample} disabled={busy}><FlaskConical className="h-4 w-4" />Load sample</Button>
        <Button variant="secondary" onClick={importDb} disabled={busy}><Upload className="h-4 w-4" />Open .sqlite</Button>
        <Button variant="secondary" onClick={exportDb} disabled={busy}><Download className="h-4 w-4" />Export .sqlite</Button>
        <Button variant="ghost" onClick={resetDb} disabled={busy}><RotateCcw className="h-4 w-4" />Reset</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        {/* Schema explorer */}
        <aside className="max-h-[70vh] overflow-auto border-2 border-border bg-muted p-2 text-sm">
          <p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wide text-muted-foreground">
            <Database className="h-4 w-4" /> Schema
          </p>
          {schema.length === 0 && <p className="text-xs text-muted-foreground">No objects yet. Run a CREATE, or load the sample.</p>}
          {schema.map((o) => (
            <div key={`${o.type}-${o.name}`} className="mb-1">
              <button
                onClick={() => (o.type === 'table' || o.type === 'view') ? browseTable(o.name) : setSql((s) => `${o.sql};\n${s}`)}
                className="flex w-full items-center gap-1 text-left font-bold hover:text-accent"
                title={o.type === 'table' || o.type === 'view' ? 'Browse rows' : 'Insert DDL into editor'}
              >
                <Table2 className="h-3.5 w-3.5" />{o.name}
                <span className="ml-auto text-[10px] uppercase text-muted-foreground">{o.type}</span>
              </button>
              {o.columns && (
                <ul className="ml-4 text-xs text-muted-foreground">
                  {o.columns.map((c) => (
                    <li key={c.name}>{c.name} <span className="opacity-60">{c.type}{c.pk ? ' PK' : ''}{c.notnull ? ' •' : ''}</span></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>

        {/* Editor + results */}
        <div className="space-y-3">
          <MonacoEditor value={sql} language="sql" onChange={setSql} onMount={onMount} height="34vh" />

          {error && <Alert variant="error">{error}</Alert>}
          {message && !error && <p className="text-sm font-bold text-muted-foreground">{message}</p>}

          {grids.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {grids.map((_, i) => (
                <button key={i} onClick={() => setActiveGrid(i)}
                  className={`border-2 border-border px-2 py-0.5 text-xs font-bold ${i === activeGrid ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                  Result {i + 1}
                </button>
              ))}
            </div>
          )}

          {grid && grid.columns.length > 0 && (
            <div className="space-y-2">
              <div className="max-h-[40vh] overflow-auto border-2 border-border">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>{grid.columns.map((c) => <th key={c} className="border-2 border-border px-2 py-1 text-left font-bold">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {grid.rows.slice(0, 1000).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} onClick={() => navigator.clipboard?.writeText(cell == null ? '' : String(cell))}
                            className="cursor-copy border-2 border-border px-2 py-1 font-mono">
                            {cell == null ? <span className="opacity-40">NULL</span> : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {grid.rows.length > 1000 && <span>Showing first 1000 of {grid.rows.length} rows.</span>}
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" onClick={() => downloadService.download(new Blob([toCsv(grid)], { type: 'text/csv' }), 'result.csv')}>Export CSV</Button>
                  <Button variant="secondary" onClick={() => downloadService.download(new Blob([toJson(grid)], { type: 'application/json' }), 'result.json')}>Export JSON</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Confirm the `Alert` component supports `variant="warning"`**

Run: `grep -nE "warning|variant" src/components/ui/Alert.tsx`
Expected: a `warning` variant exists. If it does not, change the `<Alert variant="warning">` to `<Alert variant="error">` in the island (keep the copy) and note it in this checkbox.

- [ ] **Step 3: Register the tool**

In `src/registry/tools.ts`, add `Database` to the Lucide import line (if not already present), then add this entry after the `code-scratchpad` entry:

```ts
  {
    id: 'sqlite-playground',
    name: 'SQLite Playground',
    category: 'Playground',
    route: '/tools/sqlite-playground',
    keywords: ['sqlite', 'sql', 'database', 'db', 'query', 'table', 'index', 'ddl', 'dml', 'playground'],
    icon: Database,
    summary: 'Run SQL against an on-device SQLite database',
    load: () => import('@/islands/playground/SqlitePlayground'),
    status: 'stable'
  },
```

- [ ] **Step 4: Build**

Run: `npm run build 2>&1 | tail -2`
Expected: `[build] Complete!` with the page count up by 1 vs Task 6.

- [ ] **Step 5: Headless-verify the full flow (create → insert → select grid → persist → export)**

Run:

```bash
npx astro preview --port 4353 > /tmp/pv.log 2>&1 &
sleep 4
npm install -D puppeteer-core --legacy-peer-deps >/dev/null 2>&1
cat > /tmp/dbcheck.mjs << 'EOF'
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
let errs=[]; p.on('pageerror', e=>errs.push(e.message.slice(0,160)));
await p.goto('http://localhost:4353/tools/sqlite-playground',{waitUntil:'networkidle2',timeout:30000});
await new Promise(r=>setTimeout(r,1500));
// Load the sample DB via its button, then run a query.
await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/load sample/i.test(b.textContent))?.click());
await new Promise(r=>setTimeout(r,1500));
await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/^run/i.test(b.textContent))?.click());
await new Promise(r=>setTimeout(r,1200));
const grid = await p.evaluate(()=>{
  const rows = document.querySelectorAll('table tbody tr').length;
  const cols = document.querySelectorAll('table thead th').length;
  const schema = [...document.querySelectorAll('aside button')].map(b=>b.textContent.trim()).join(',');
  return { rows, cols, schema };
});
console.log('grid rows:', grid.rows, '| cols:', grid.cols, '| schema:', grid.schema);
console.log('pageerrors:', errs.length?errs.join(';'):'none');
await b.close();
EOF
node /tmp/dbcheck.mjs
kill %1 2>/dev/null
npm uninstall puppeteer-core --legacy-peer-deps >/dev/null 2>&1
```

Expected: `grid rows: 5 | cols: 3` (the sample join returns 5 albums), `schema` lists `albums`/`artists`, and `pageerrors: none`.

- [ ] **Step 6: Commit**

```bash
git add src/islands/playground/SqlitePlayground.tsx src/registry/tools.ts
git commit -m "feat(playground): SQLite Playground UI (schema explorer, editor, results grid)"
```

---

## Task 8: Docs + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the Phase 9 section to README**

Insert before the `## Testing` heading in `README.md`:

```markdown
✅ **Phase 9 — Playground (2 tools, on-device dev sandboxes):**
- Code Scratchpad — a VS Code-grade **multi-file** editor on self-hosted
  **Monaco**: native multi-cursor, move/copy line, column select, find & replace.
  Open/save real files (File System Access API), autosaved to IndexedDB.
- SQLite Playground — a durable in-browser **SQLite** database
  (`@sqlite.org/sqlite-wasm` + OPFS SAHPool, no COOP/COEP) with a schema explorer,
  a SQL editor (⌘/Ctrl+Enter to run), and a **visual results grid**. DDL/DML show
  a summary and refresh the schema; import/export `.sqlite`; a sample DB to explore.

Both ride one lazily-loaded, self-hosted Monaco engine — never in the shell
payload. Nothing is uploaded.
```

- [ ] **Step 2: Run the full unit suite**

Run: `npx vitest run 2>&1 | grep -E "Test Files|Tests "`
Expected: all pass (totals up by the 4 new lib test files).

- [ ] **Step 3: Full production build**

Run: `npm run build 2>&1 | tail -2`
Expected: `[build] Complete!` with 2 more pages than before Phase 9.

- [ ] **Step 4: Confirm no staged wasm is committed**

Run: `git status --short | grep -E "public/sqlite" && echo "ABORT: staged wasm" || echo "clean"`
Expected: `clean` (public/sqlite is gitignored).

- [ ] **Step 5: Commit and push**

```bash
git add README.md
git commit -m "docs(playground): document Phase 9 dev sandboxes"
git push origin develop
```

---

## Notes for the implementer

- **Verification harness:** every UI/wasm task installs `puppeteer-core` with `--legacy-peer-deps`, runs against `astro preview`, then uninstalls it. Chrome path is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on this machine. Do NOT commit `puppeteer-core`.
- **Never commit `public/sqlite/`, `public/models/`, or other staged wasm** — they're gitignored and staged by `scripts/copy-wasm.mjs`/`stage-models.mjs`.
- **Monaco is the risk.** If Task 3 Step 7 fails, resolve it there (see the fallback note) before building any tool on top — exactly as the ffmpeg core issue was resolved before shipping Video→GIF.
- **Keybinding constant** in `SqlitePlayground.onMount`: `2048 | 3` is `monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter`; import `monaco` from `./monaco-setup` and use the named constants instead if you prefer clarity over avoiding the extra import.
```
