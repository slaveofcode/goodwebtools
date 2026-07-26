# Playground Tools — Code Scratchpad + SQLite Playground

**Status:** Approved (2026-07-13)

**Goal:** Add a new **Playground** category to GoodWebTools with two on-device dev
sandboxes — a VS Code-grade **Code Scratchpad** and a **SQLite Playground** —
built on one shared, lazily-loaded Monaco editor. Both run fully client-side with
no network egress, letting developers explore before committing to a bigger setup.

**Non-goals (YAGNI for v1):** project/folder tree, git, build/run of code,
multi-database switching, query-history panel. These may come later; they are
explicitly out of scope here.

---

## 1. Overview

Two tools, one engine:

1. **Code Scratchpad** — a multi-file editor with the exact VS Code editing
   muscle memory (multi-cursor, move/copy line, column select, find & replace),
   open/save real files from disk, and autosaved scratch buffers.
2. **SQLite Playground** — a durable, in-browser SQLite database with a schema
   explorer, SQL editor, and a **visual results grid** for queries and DDL/DML.

Both sit on a shared **Monaco** foundation (the real VS Code editor engine),
loaded once, lazily, and never present in the app shell's initial payload.

The two tools live under a new `Playground` category. Future exploratory tools
(e.g. the planned HTML/CSS/JS live playground) can join the same category.

---

## 2. Shared foundation: the Monaco engine

### 2.1 Packaging & isolation

- Depend on **`monaco-editor`** directly and import it in a client-only React
  island — **not** `@monaco-editor/react`'s default AMD loader, which pulls
  Monaco from a CDN and would break the no-external-requests promise.
- Self-host all workers via Vite `?worker` imports and wire
  `self.MonacoEnvironment.getWorker`:
  - `monaco-editor/esm/vs/editor/editor.worker?worker` (base)
  - `.../language/typescript/ts.worker?worker`
  - `.../language/json/json.worker?worker`
  - `.../language/css/css.worker?worker`
  - `.../language/html/html.worker?worker`
- Register full language features (IntelliSense, formatting, diagnostics) for
  **TypeScript/JavaScript, JSON, CSS, HTML, and SQL**; ship built-in Monarch
  syntax highlighting for Markdown, Python, Go, Rust, YAML, XML, Shell, and the
  other grammars Monaco bundles.
- Define a `gwt` Monaco theme mapped to the Neo-Brutalism palette (cream / near
  black, violet accent), switching with the app's light/dark toggle.

### 2.2 Interface

`src/islands/playground/MonacoEditor.tsx` exposes a small, stable wrapper:

```ts
interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  readOnly?: boolean;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
}
```

A sibling `src/islands/playground/monaco-setup.ts` performs one-time, idempotent
setup (worker env, theme, language registration) and is imported by the wrapper.

### 2.3 Build risk to validate first

The project sets `vite.worker.format: 'es'` globally (required by mupdf/pdfjs).
That forces **all** Vite-bundled workers to be ES-module workers. Monaco's
workers must load cleanly under that constraint — the same class of problem that
bit the ffmpeg core (module-worker vs classic-worker). **The first
implementation task must build the production bundle and confirm a Monaco editor
actually mounts and its language worker responds** before either tool is built on
top of it.

---

## 3. Code Scratchpad

**Route:** `/tools/code-scratchpad` · **Category:** `Playground` · **Status:**
`stable` (ship once verified).

### 3.1 Files & tabs

- In-memory model: an array of files `{ id, name, language, content, handle? }`.
- **Tabs** across the top: switch, close, and rename (double-click the tab title).
- **New file:** prompt for a name; infer `language` from the extension via a pure
  map (`.ts→typescript`, `.json→json`, `.md→markdown`, `.sql→sql`, `.py→python`,
  …; unknown → `plaintext`).
- YAGNI: no reordering, no folders.

### 3.2 Disk I/O (progressive enhancement)

Reuse the existing services (`file.service`, `download.service`,
`persistence.service`) which already wrap the File System Access API with
fallbacks:

- **Open file** → `showOpenFilePicker` (keep the `FileSystemFileHandle` on the
  tab); fallback `<input type=file>`.
- **Save** → write back to the tab's handle when present; otherwise behave as
  Save as.
- **Save as…** → `showSaveFilePicker`; fallback: Blob download.

### 3.3 Persistence

Autosave every open tab to **IndexedDB** (object store `scratchpad-files`, keyed
by `id`, storing `{ name, language, content }`) so buffers survive a reload.
Debounced writes on change. On mount, restore all persisted tabs; if none, open a
single empty `untitled.txt`.

### 3.4 Editing

All native Monaco behaviour — no custom keybindings needed:

| Action | Shortcut (macOS) |
|--------|------------------|
| Move line up/down | `⌥↑` / `⌥↓` |
| Copy line up/down | `⇧⌥↑` / `⇧⌥↓` |
| Add cursor above/below | `⌘⌥↑` / `⌘⌥↓` |
| Select next occurrence | `⌘D` |
| Select all occurrences | `⌘⇧L` |
| Column (box) selection | `⇧⌥`+drag |
| Find / Replace | `⌘F` / `⌘⌥F` |
| Command palette | `F1` |
| Format document | `⇧⌥F` |

Toolbar extras: word-wrap toggle, minimap toggle, format button. Nothing is
uploaded; there is no network path.

---

## 4. SQLite Playground

**Route:** `/tools/sqlite-playground` · **Category:** `Playground` · **Status:**
`stable` (ship once verified).

### 4.1 Engine & persistence

- **`@sqlite.org/sqlite-wasm`** (the official SQLite team build) running inside a
  **Comlink-wrapped Web Worker** (`src/islands/playground/sqlite.worker.ts`).
- Persistence via the **OPFS SAHPool VFS** (`installOpfsSAHPoolVfs`): a durable
  database that survives reloads and needs **no** cross-origin-isolation headers
  — preserving the project's deliberate no-COOP/COEP setup.
- Serve `sqlite3.wasm` (~1 MB) and `sqlite3.mjs` **same-origin as normal static
  assets** (copied into `public/` by the existing `copy-wasm` predev/prebuild
  script). Under the 25 MB asset limit — no R2 needed.
- **Single active database** (`playground.sqlite` in the SAHPool). If OPFS is
  unavailable (older Safari), fall back to an **in-memory** DB and show a
  persistent "Not saved between visits — export to keep your data" banner.

### 4.2 Worker API

```ts
interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowsAffected: number;   // for DML
  elapsedMs: number;
  // multiple result sets from a multi-statement script:
  more?: QueryResult[];
}

interface SqliteApi {
  init(): Promise<{ persisted: boolean }>;
  exec(sql: string): Promise<QueryResult>;          // run all statements
  schema(): Promise<SchemaObject[]>;                 // tables/indexes/views/triggers
  tableRows(name: string, limit: number, offset: number): Promise<QueryResult>;
  exportDb(): Promise<Uint8Array>;                   // .sqlite bytes
  importDb(bytes: Uint8Array): Promise<void>;        // replace active DB
  reset(): Promise<void>;
  loadSample(): Promise<void>;
}
```

`SchemaObject` describes one DB object: `{ type: 'table'|'index'|'view'|'trigger',
name, sql, columns?: { name, type, pk, notnull }[] }`, parsed from
`sqlite_master` + `PRAGMA table_info`.

### 4.3 Layout (three panes)

- **Left — Schema explorer.** Tree of tables (expand → columns with type, PK, NOT
  NULL), indexes, views, triggers. Clicking a table opens its rows in the grid
  (**data-browser**, no SQL required); a "Show DDL" affordance drops its `CREATE`
  statement into the editor / a DDL view. The explorer **auto-refreshes after any
  DDL**.
- **Center — SQL editor.** Shared Monaco with the `sql` language. `⌘/Ctrl+Enter`
  runs **all** statements, or the **current selection** if text is selected.
  Multi-statement scripts supported. "Format SQL" button.
- **Bottom — Results.**
  - **SELECT / query** → the **visual results grid**: typed columns, sortable,
    virtualized for large result sets, click-to-copy cells. Multiple result sets
    from one script render as grid tabs.
  - **DDL** (`CREATE`/`ALTER`/`DROP`) → a messages line ("Table `orders`
    created · N ms"); schema explorer refreshes; option to auto-open the affected
    table.
  - **DML** (`INSERT`/`UPDATE`/`DELETE`) → "N rows affected · N ms"; option to
    auto-`SELECT` the touched table to visualize the change.
  - **Errors** → SQLite's message shown inline in a clearly-marked error state.
  - Export the current grid as **CSV** or **JSON**.

### 4.4 DB management toolbar

New DB (reset to empty) · Open `.sqlite` (import bytes) · Export `.sqlite`
(download the live DB) · **Load sample** (a small seeded schema — a handful of
related tables with rows — so the tool is explorable on first open) · Reset.

---

## 5. Data flow

```
Code Scratchpad
  island  ⇄  IndexedDB (autosaved files)
          ⇄  File System Access API (open / save to disk)
          →  Monaco holds the active buffer

SQLite Playground
  island  ⇄  Comlink  ⇄  Web Worker  ⇄  @sqlite.org/sqlite-wasm + OPFS (SAHPool)
          →  Monaco holds the SQL buffer
          ←  worker returns { columns, rows, rowsAffected, elapsedMs, more? }
```

Running SQLite in the worker keeps the UI responsive during heavy queries and
imports.

---

## 6. Testing

**Vitest — pure logic (no DOM/WASM):**
- `extensionToLanguage()` map.
- `splitStatements(sql)` — split a multi-statement script on `;`, respecting
  string literals, `--` and `/* */` comments (so grids/messages map to the right
  statement).
- `classifyStatement(sql)` → `'select' | 'ddl' | 'dml' | 'other'` (drives which
  result view to show).
- Result-set serializers → `toCsv(result)` / `toJson(result)`.
- Schema parsing helper: `sqlite_master` rows + `PRAGMA table_info` → `SchemaObject`.

**Headless production-build checks** (`astro preview`, as used for every prior
phase):
- SQLite: `CREATE TABLE` → schema explorer shows it → `INSERT` → `SELECT` renders
  the grid → `CREATE INDEX` → **reload persists the data** → `Export .sqlite`
  then `Open` round-trips → sample loads.
- Scratchpad: mounts a Monaco editor whose worker responds; a multi-cursor edit
  and find/replace work; open tabs persist across reload.

---

## 7. Sequencing (independently shippable steps)

1. **Foundation** — `Playground` category (extend the `Category` union +
   registry + any shell filter) and the shared Monaco island; validate the
   worker-format build risk (§2.3) on the production build.
2. **Code Scratchpad** — tabs, disk I/O, IndexedDB autosave, editing.
3. **SQLite Playground** — worker + sqlite-wasm/OPFS, schema explorer, SQL editor,
   visual results grid, DDL/DML messages, import/export, sample DB.

Each step ends with a green production build, passing unit tests, and a headless
verification of the new surface.

---

## 8. Risks & fallbacks

| Risk | Handling |
|------|----------|
| Monaco workers vs global `worker.format: 'es'` | Validate on the production build in step 1 before building tools; adjust worker setup if needed (mirrors the ffmpeg fix). |
| Monaco bundle weight | Route-level dynamic import only; never in the shell payload; register only needed languages. |
| OPFS SAHPool unavailable (older Safari) | Fall back to in-memory DB + "not persisted, export to keep" banner. |
| File System Access API absent (Firefox/Safari) | Fall back to `<input type=file>` + Blob download (services already do this). |
| Large query result sets | Virtualized grid; `tableRows` paginates the data-browser with `LIMIT`/`OFFSET`. |
