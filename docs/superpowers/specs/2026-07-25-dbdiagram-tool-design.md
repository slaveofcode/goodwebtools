# DB Diagram Tool — Design

**Status:** Approved (2026-07-25)
**Scope:** Spec B of a two-spec initiative. Spec A is Image Tools & Annotator Handoff.

## Goal

A dbdiagram.io-style database schema tool in the **Draw** category: write schema in DBML in a code editor, see it rendered as a live, interactive ER diagram (zoom/pan/drag/minimap), with **bold hover-highlight** of a table's relationships, plus **SQL export** to multiple dialects and **image export** (PNG/JPEG/WebP/SVG). Same power-user chrome as the Whiteboard tool (expand, hide-navbar, IndexedDB persistence).

## Architecture

A single React island split into three panes: a **Monaco DBML editor** (left), a **react-flow ER diagram** (right), and a **toolbar** (top). DBML text is the source of truth. On (debounced) edit, parse DBML → build nodes/edges → auto-layout with dagre → render in react-flow. Layout positions the user drags are preserved across re-parses (keyed by table name) and persisted. Everything is client-side, mirroring the Whiteboard's dynamic-import + IndexedDB pattern.

**Data flow:**
```
Monaco (DBML text) --debounce 400ms--> parseDbml (@dbml/core)
   -> { tables, refs } -> buildFlow() -> { nodes, edges }
   -> dagreLayout() (only for tables without a saved position)
   -> react-flow render
DBML text + node positions --debounce--> IndexedDB (gwt-dbdiagram)
Toolbar -> SQL export (dialect) | Image export (format, scale)
```

## Tech Stack

- **@dbml/core** — parse DBML to a `Database` model; native SQL export for `postgres`, `mysql`, `mssql`, `oracle`. (Confirmed via the library API.)
- **@xyflow/react** (react-flow v12) — interactive diagram: zoom, pan, node drag, minimap, controls, custom node + custom edge types, `onNodeMouseEnter`/`onNodeMouseLeave` for hover.
- **@dagrejs/dagre** — automatic left-to-right layout for tables lacking a saved position.
- **html-to-image** — export the diagram to PNG/JPEG/SVG; WebP via `toCanvas` → `canvas.toBlob('image/webp')`.
- **Monaco** — already self-hosted in the app; DBML edited as plain text (custom lightweight tokenizer optional, not required for v1).
- Existing: `idb`, `downloadService`, `ImageResult`/copy utilities, lucide icons.

## Global Constraints

- **Zero external network requests at runtime** — all four deps bundled; Monaco already self-hosted; no CDN.
- **All client-side** — no server round-trips.
- Follow existing conventions: `ToolDef` registry entry, island default-export (no required props), Whiteboard-style dynamic import for heavy deps, IndexedDB via `idb`.
- New deps added to `package.json`: `@dbml/core`, `@xyflow/react`, `@dagrejs/dagre`, `html-to-image`. Verify bundle builds (Astro/Vite) and desktop (Tauri) unaffected.
- **Draw category**, route `/tools/db-diagram`, `status: 'beta'`.

---

## Component 1: DBML parsing & model (`src/tools/draw/dbml.lib.ts`)

Pure functions wrapping @dbml/core, isolating the library so the island and tests don't touch it directly.

- `parseDbml(source: string): { db: Database | null; error: string | null }` — runs `Parser.parse(source, 'dbml')` (or `importer`), catching parse errors and returning a human-readable message + line if available. Never throws.
- `buildFlow(db: Database): { nodes: DiagramNode[]; edges: DiagramEdge[] }` — walks the parsed schema:
  - One `DiagramNode` per table: `{ id: tableName, data: { name, columns: { name, type, pk, fk, notNull, unique }[] }, type: 'table' }`.
  - One `DiagramEdge` per relationship (ref): `{ id, source, target, sourceHandle: <fk column>, targetHandle: <pk column>, data: { relation: '1-n'|'1-1'|'n-1' } }`. Column-level handles enable endpoint highlighting.
- Types `DiagramNode`, `DiagramEdge`, `TableColumn` exported for the island and tests.

**Tests (`dbml.lib.test.ts`):** parse a 2-table DBML with a ref → assert node count, column flags (pk/fk), edge source/target + handles; parse invalid DBML → `error` non-null, `db` null; empty string → empty nodes/edges, no error.

## Component 2: Auto-layout (`src/tools/draw/layout.lib.ts`)

- `layoutNodes(nodes: DiagramNode[], edges: DiagramEdge[], saved: Record<string, {x:number;y:number}>): DiagramNode[]` — for any node with a `saved[id]` position, use it; for the rest, run dagre (rankdir `LR`, node size estimated from column count) and assign computed positions. Pure except for dagre; deterministic given inputs.

**Tests:** nodes with saved positions keep them; nodes without get distinct non-overlapping positions; result length == input length.

## Component 3: The island (`src/islands/draw/DbDiagram.tsx`)

### Layout & chrome (mirror `Whiteboard.tsx`)
- Split pane: Monaco editor left (~40%, draggable splitter), diagram right. Splitter ratio persisted to `localStorage['gwt-dbdiagram-split']`.
- **Expand** overlay (fixed, full-viewport) persisted to `localStorage['gwt-dbdiagram-expanded']`; **hide-navbar** pull-tab `gwt-dbdiagram-navhidden` — same mechanism/keys convention as Whiteboard.
- Dynamic imports after mount: `@xyflow/react` (+ its CSS), `@dagrejs/dagre`, `@dbml/core`, `html-to-image` — none in the initial island bundle.

### Diagram
- Custom **TableNode**: header (table name) + column rows; each column row is a react-flow `Handle` (source+target, id = column name) so edges attach at the exact column. PK columns marked (key icon), FK columns marked.
- Custom **RelationEdge**: default style is a smooth bezier; carries `data.relation` for optional cardinality markers.
- react-flow `Controls` (zoom in/out/fit), `MiniMap`, `Background`. Node drag enabled; on drag-stop, save that node's position to state + IndexedDB.
- Seed content: a small example schema (users/posts) when there's no saved DBML, so the tool isn't empty on first load.

### Bold hover-highlight (the emphasized feature — stronger than dbdiagram.io)
On `onNodeMouseEnter(table)`:
- Compute the set of connected edges and neighbor tables.
- **Connected edges** get a `highlighted` class: **thicker stroke (3–4px vs 1.5px)**, an **accent color** (e.g. `--accent`/amber), an animated dashed flow (react-flow `animated`), and a soft glow via SVG `filter: drop-shadow`. These constants live in a `HIGHLIGHT` config object at the top of the file so they're easily tunable:
  ```ts
  const HIGHLIGHT = {
    edgeWidth: 3.5, edgeWidthIdle: 1.5, color: 'var(--accent, #f59e0b)',
    glow: 'drop-shadow(0 0 4px var(--accent, #f59e0b))',
    dimOpacity: 0.25, nodeBorderWidth: 2.5,
  };
  ```
- The **hovered table** and **neighbor tables** get an accent border (`nodeBorderWidth`) and full opacity.
- The **FK and PK endpoint columns** on the participating tables get a highlighted background (column-level emphasis), using the edge `sourceHandle`/`targetHandle` ids.
- **All other** nodes and edges dim to `dimOpacity` (~25%), so the active relationship pops.
- `onNodeMouseLeave` restores everything. Implemented by deriving `className`/`style` from a `hoveredId` state in the node/edge render — no imperative DOM mutation.

### Persistence (IndexedDB `gwt-dbdiagram`, store `doc`, key `current`)
- Value `{ dbml: string, positions: Record<string, {x,y}>, updatedAt: number }`.
- `loadDoc()/saveDoc()` in `src/tools/draw/dbdiagram.store.ts` (mirror `whiteboard.store.ts`). Debounced autosave on DBML change and on node drag-stop.

## Component 4: SQL export (`src/tools/draw/sql-export.lib.ts`)

- `exportSql(source: string, dialect: Dialect): string` where `Dialect = 'postgres'|'mysql'|'mssql'|'oracle'|'sqlite'|'clickhouse'`.
  - **Native** (`postgres`,`mysql`,`mssql`,`oracle`): use @dbml/core's exporter (`ModelExporter.export(db, dialect)` / `importer`+`exporter` path).
  - **Custom** (`sqlite`, `clickhouse`): generate DDL from the parsed `Database` model via a small `generateDDL(db, dialect)`:
    - **sqlite** — `CREATE TABLE` with SQLite type affinities (INTEGER/TEXT/REAL/BLOB), `PRIMARY KEY`, `AUTOINCREMENT` for int PKs, `FOREIGN KEY ... REFERENCES`, no schema-qualified names.
    - **clickhouse** — `CREATE TABLE ... ENGINE = MergeTree()` with a chosen `ORDER BY` (PK columns, else `tuple()`), map types (Int32/Int64/String/Float64/DateTime/UInt8 for bool), `Nullable(...)` for nullable columns; FKs are omitted (ClickHouse has no FK constraints) with an explanatory comment.
- UI: dialect dropdown in the toolbar → generates SQL into a modal/panel with a Monaco read-only viewer, **Copy** and **Download `.sql`** (`downloadService.download`).

**Tests (`sql-export.lib.test.ts`):** for a fixed 2-table DBML — postgres output contains `CREATE TABLE` + `FOREIGN KEY`/`REFERENCES`; sqlite output uses affinity types + `AUTOINCREMENT` and no schema prefix; clickhouse output contains `ENGINE = MergeTree` + `ORDER BY` and omits `FOREIGN KEY`; unknown dialect throws.

## Component 5: Image export (`src/tools/draw/diagram-image.lib.ts`)

- `exportDiagramImage(el: HTMLElement, opts: { format: 'png'|'jpeg'|'webp'|'svg'; scale?: number; background?: string }): Promise<Blob>`:
  - Compute full-diagram bounds with react-flow's `getNodesBounds` + `getViewportForBounds` so the export captures the entire graph, not just the visible viewport.
  - `svg` → `htmlToImage.toSvg` → Blob (`image/svg+xml`).
  - `png`/`jpeg` → `toPng`/`toJpeg` at `pixelRatio = scale` (JPEG gets an opaque background).
  - `webp` → `toCanvas` then `canvas.toBlob(resolve, 'image/webp', quality)`.
- UI: format dropdown + scale (1×/2×/3×) in the toolbar → produces a Blob shown via `ImageResult` (Download/Copy/**Edit in Annotator** — the handoff from Spec A applies here too, letting a user annotate an exported diagram).

**Tests:** thin unit test for the format→MIME mapping and scale→pixelRatio mapping (the html-to-image calls themselves are integration-verified manually, since they need a real DOM/canvas).

---

## Registry addition (`src/registry/tools.ts`)

One `ToolDef`: `{ id:'db-diagram', name:'DB Diagram', category:'Draw', route:'/tools/db-diagram', status:'beta', icon: <Database/Table icon>, keywords:['dbml','erd','schema','database','diagram','sql','er'], summary:'Design database schemas in DBML with a live ER diagram, SQL export, and image export.', load: () => import('...DbDiagram') }`.

## File Structure

```
src/islands/draw/DbDiagram.tsx                 (new — the island)
src/tools/draw/dbdiagram.store.ts              (new — IndexedDB load/save)
src/tools/draw/dbml.lib.ts (+ .test.ts)        (new — parse + buildFlow)
src/tools/draw/layout.lib.ts (+ .test.ts)      (new — dagre auto-layout)
src/tools/draw/sql-export.lib.ts (+ .test.ts)  (new — dialect SQL export)
src/tools/draw/diagram-image.lib.ts (+ .test.ts) (new — image export)
src/registry/tools.ts                           (modify — 1 entry)
package.json                                    (modify — 4 deps)
```

## Error Handling

- **Parse errors:** show a non-blocking banner in the editor pane with the message/line; keep the last successfully-rendered diagram on screen (don't blank it) so the user can fix typos without losing context.
- **Export with invalid DBML:** disable SQL/image export (or surface the parse error) rather than exporting a broken schema.
- **IndexedDB failures:** catch and no-op (fall back to in-memory only), like the Whiteboard.
- **Empty schema:** valid state — empty diagram, export produces empty/near-empty output without error.

## Testing Strategy

Unit-test all four pure libs (dbml parse/buildFlow, layout, sql-export per dialect, image format mapping) with Vitest. The interactive island (hover-highlight, drag, zoom, persistence, expand) is verified manually — same as the Whiteboard. All existing tests must stay green.

## Out of Scope (v1, YAGNI)

- DBML syntax highlighting/autocomplete in Monaco (plain-text editing for v1).
- Importing existing SQL → DBML (only DBML → SQL).
- Multi-file/multi-schema projects, sharing, or server persistence.
- Table notes/enums rendering beyond what buildFlow needs for columns and refs (enums parsed but rendered minimally if at all in v1).
