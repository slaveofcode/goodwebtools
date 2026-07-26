# DB Diagram Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dbdiagram.io-style tool (Draw category) where you write DBML in a code editor and see a live, interactive ER diagram with bold hover-highlight of relationships, plus SQL export to six dialects and image export to PNG/JPEG/WebP/SVG.

**Architecture:** One React island with a Monaco (plain-text) DBML editor and an `@xyflow/react` ER diagram, plus a toolbar. DBML is the source of truth: on debounced edit it's parsed with `@dbml/core`, mapped to nodes/edges, auto-laid-out with `@dagrejs/dagre` (only for tables without a saved position), and rendered. DBML text + dragged node positions persist to IndexedDB. The island mirrors the existing Whiteboard's dynamic-import + expand/hide-navbar + IndexedDB patterns.

**Tech Stack:** `@dbml/core` (parse + native SQL export), `@xyflow/react` v12 (interactive diagram), `@dagrejs/dagre` (layout), `html-to-image` (image export), self-hosted Monaco (already in app), `idb`, React 18, Vitest + jsdom.

## Global Constraints

- **Zero external network requests at runtime** — all four new deps bundled; Monaco already self-hosted; no CDN.
- **All client-side** — no server round-trips.
- Follow existing conventions: `ToolDef` entry (`src/types/tool.ts`), island default-export (no required props), Whiteboard-style dynamic import for heavy browser-only deps, IndexedDB via `idb` (mirror `src/tools/draw/whiteboard.store.ts`).
- Tool: **category `Draw`**, route `/tools/db-diagram`, `status: 'beta'`.
- Native SQL export dialects (via `@dbml/core`): `postgres`, `mysql`, `mssql`, `oracle`. Custom-generated dialects: `sqlite`, `clickhouse`.
- **Model-shape note for the implementer:** `@dbml/core`'s parsed `Database` object shape varies slightly across versions. Every `.lib` task below is test-first with **real DBML** — run the test, and if a field accessor (e.g. `field.not_null` vs `field.notNull`, `endpoint.fieldNames` vs `endpoint.fields`) doesn't match the installed version, `console.log(JSON.stringify(db.schemas[0], null, 2))` once, adjust the accessor, and keep the asserted **output contract** unchanged. The tests pin behavior, not library internals.

---

## File Structure

```
package.json                                     (modify — add 4 deps)
src/tools/draw/dbml.lib.ts (+ .test.ts)          (new — parseDbml + buildFlow)
src/tools/draw/layout.lib.ts (+ .test.ts)        (new — dagre auto-layout)
src/tools/draw/sql-export.lib.ts (+ .test.ts)    (new — dialect SQL export)
src/tools/draw/diagram-image.lib.ts (+ .test.ts) (new — image export mapping + export)
src/tools/draw/dbdiagram.store.ts                (new — IndexedDB load/save)
src/islands/draw/DbDiagram.tsx                   (new — the island)
src/islands/draw/db-diagram/TableNode.tsx        (new — custom react-flow node)
src/islands/draw/db-diagram/RelationEdge.tsx     (new — custom react-flow edge)
src/registry/tools.ts                            (modify — 1 entry)
```

---

## Task 1: Add dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the four runtime deps**

Run:
```bash
npm install --legacy-peer-deps @dbml/core @xyflow/react @dagrejs/dagre html-to-image
```
Expected: all four appear in `package.json` dependencies; install succeeds.

- [ ] **Step 2: Verify the app still builds with them present**

Run: `npm run build`
Expected: build succeeds (deps present but not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @dbml/core, @xyflow/react, @dagrejs/dagre, html-to-image"
```

---

## Task 2: DBML parsing & flow model

**Files:**
- Create: `src/tools/draw/dbml.lib.ts`
- Test: `src/tools/draw/dbml.lib.test.ts`

**Interfaces:**
- Produces:
  - `type TableColumn = { name: string; type: string; pk: boolean; fk: boolean; notNull: boolean; unique: boolean }`
  - `type DiagramNode = { id: string; type: 'table'; data: { name: string; columns: TableColumn[] } }`
  - `type DiagramEdge = { id: string; source: string; target: string; sourceHandle: string; targetHandle: string; data: { relation: string } }`
  - `parseDbml(source: string): { db: unknown | null; error: string | null }`
  - `buildFlow(db: unknown): { nodes: DiagramNode[]; edges: DiagramEdge[] }`

- [ ] **Step 1: Write the failing test with real DBML**

Create `src/tools/draw/dbml.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseDbml, buildFlow } from './dbml.lib';

const SCHEMA = `
Table users {
  id int [pk, increment]
  email varchar [not null, unique]
}
Table posts {
  id int [pk]
  user_id int
  title varchar
}
Ref: posts.user_id > users.id
`;

describe('parseDbml', () => {
  it('parses valid DBML without error', () => {
    const { db, error } = parseDbml(SCHEMA);
    expect(error).toBeNull();
    expect(db).not.toBeNull();
  });
  it('reports an error for invalid DBML without throwing', () => {
    const { db, error } = parseDbml('Table {{{ broken');
    expect(db).toBeNull();
    expect(error).toBeTruthy();
  });
  it('treats empty input as empty, not an error', () => {
    const { db, error } = parseDbml('');
    expect(error).toBeNull();
    // buildFlow on empty is asserted below
    expect(buildFlow(db)).toEqual({ nodes: [], edges: [] });
  });
});

describe('buildFlow', () => {
  it('maps tables to nodes with column flags', () => {
    const { db } = parseDbml(SCHEMA);
    const { nodes } = buildFlow(db);
    expect(nodes.map((n) => n.id).sort()).toEqual(['posts', 'users']);
    const users = nodes.find((n) => n.id === 'users')!;
    const id = users.data.columns.find((c) => c.name === 'id')!;
    expect(id.pk).toBe(true);
    const email = users.data.columns.find((c) => c.name === 'email')!;
    expect(email.notNull).toBe(true);
    expect(email.unique).toBe(true);
  });
  it('maps a ref to an edge with column-level handles', () => {
    const { db } = parseDbml(SCHEMA);
    const { edges } = buildFlow(db);
    expect(edges).toHaveLength(1);
    const e = edges[0];
    // FK side is posts.user_id, PK side is users.id (orientation-independent check)
    const endpoints = [`${e.source}.${e.sourceHandle}`, `${e.target}.${e.targetHandle}`].sort();
    expect(endpoints).toEqual(['posts.user_id', 'users.id']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/tools/draw/dbml.lib.test.ts`
Expected: FAIL — cannot resolve `./dbml.lib`.

- [ ] **Step 3: Write dbml.lib**

Create `src/tools/draw/dbml.lib.ts`. Written against the `@dbml/core` class-instance model (`db.schemas[].tables[].fields[]`, `schema.refs[].endpoints[]`); adjust accessors if the installed version differs (see the model-shape note in Global Constraints), keeping the asserted output contract.

```ts
import { Parser } from '@dbml/core';

export interface TableColumn {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  notNull: boolean;
  unique: boolean;
}
export interface DiagramNode {
  id: string;
  type: 'table';
  data: { name: string; columns: TableColumn[] };
}
export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  data: { relation: string };
}

/** Parse DBML text. Never throws — returns { db, error }. Empty input => { db:null, error:null }. */
export function parseDbml(source: string): { db: unknown | null; error: string | null } {
  if (!source.trim()) return { db: null, error: null };
  try {
    const db = new Parser().parse(source, 'dbml');
    return { db, error: null };
  } catch (e) {
    const err = e as { message?: string; diags?: { message: string; location?: { start?: { line?: number } } }[] };
    // @dbml/core throws a CompilerError with a `diags` array; surface the first.
    const first = err.diags?.[0];
    const line = first?.location?.start?.line;
    const msg = first?.message ?? err.message ?? 'Invalid DBML';
    return { db: null, error: line ? `Line ${line}: ${msg}` : msg };
  }
}

// Loose shapes for the parsed model (see model-shape note).
interface RawField { name: string; type?: { type_name?: string }; pk?: boolean; not_null?: boolean; unique?: boolean; increment?: boolean }
interface RawTable { name: string; fields?: RawField[] }
interface RawEndpoint { tableName?: string; fieldNames?: string[]; fields?: { name: string }[]; relation?: string }
interface RawRef { endpoints?: RawEndpoint[] }
interface RawSchema { tables?: RawTable[]; refs?: RawRef[] }
interface RawDb { schemas?: RawSchema[] }

const endpointField = (ep: RawEndpoint): string => ep.fieldNames?.[0] ?? ep.fields?.[0]?.name ?? '';

/** Map a parsed Database into react-flow nodes and edges. Safe on null. */
export function buildFlow(db: unknown): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const schemas = (db as RawDb | null)?.schemas ?? [];
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const fkColumns = new Set<string>(); // `${table}.${column}` marked as FK

  // First pass: collect FK columns from refs so we can flag them on the nodes.
  for (const schema of schemas) {
    for (const ref of schema.refs ?? []) {
      const eps = ref.endpoints ?? [];
      for (const ep of eps) fkColumns.add(`${ep.tableName}.${endpointField(ep)}`);
    }
  }

  for (const schema of schemas) {
    for (const table of schema.tables ?? []) {
      nodes.push({
        id: table.name,
        type: 'table',
        data: {
          name: table.name,
          columns: (table.fields ?? []).map((f) => ({
            name: f.name,
            type: f.type?.type_name ?? '',
            pk: !!f.pk,
            fk: fkColumns.has(`${table.name}.${f.name}`),
            notNull: !!f.not_null,
            unique: !!f.unique,
          })),
        },
      });
    }
    (schema.refs ?? []).forEach((ref, i) => {
      const [a, b] = ref.endpoints ?? [];
      if (!a || !b) return;
      // Orient FK (many) -> PK (one): the '*' side is the FK source.
      const fkFirst = a.relation === '*' || b.relation === '1';
      const src = fkFirst ? a : b;
      const dst = fkFirst ? b : a;
      edges.push({
        id: `ref-${src.tableName}-${endpointField(src)}-${dst.tableName}-${endpointField(dst)}-${i}`,
        source: src.tableName ?? '',
        target: dst.tableName ?? '',
        sourceHandle: endpointField(src),
        targetHandle: endpointField(dst),
        data: { relation: `${a.relation ?? ''}-${b.relation ?? ''}` },
      });
    });
  }
  return { nodes, edges };
}
```

- [ ] **Step 4: Run to verify it passes (adjust accessors if needed)**

Run: `npm test -- --run src/tools/draw/dbml.lib.test.ts`
Expected: PASS. If any assertion fails on a flag (e.g. `notNull`), add a one-time `console.log(JSON.stringify((parseDbml(SCHEMA).db as any).schemas[0].tables[0].fields[0]))` to the test, inspect the real field names, update the `RawField` accessors, and re-run. Remove the log once green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/draw/dbml.lib.ts src/tools/draw/dbml.lib.test.ts
git commit -m "feat(dbdiagram): parse DBML and build react-flow nodes/edges"
```

---

## Task 3: Auto-layout with dagre

**Files:**
- Create: `src/tools/draw/layout.lib.ts`
- Test: `src/tools/draw/layout.lib.test.ts`

**Interfaces:**
- Consumes: `DiagramNode`, `DiagramEdge` (Task 2); `@dagrejs/dagre`.
- Produces:
  - `type PositionedNode = DiagramNode & { position: { x: number; y: number } }`
  - `layoutNodes(nodes: DiagramNode[], edges: DiagramEdge[], saved: Record<string, { x: number; y: number }>): PositionedNode[]`

- [ ] **Step 1: Write the failing test**

Create `src/tools/draw/layout.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { layoutNodes } from './layout.lib';
import type { DiagramNode, DiagramEdge } from './dbml.lib';

const node = (id: string, cols = 2): DiagramNode => ({
  id,
  type: 'table',
  data: { name: id, columns: Array.from({ length: cols }, (_, i) => ({ name: `c${i}`, type: 'int', pk: i === 0, fk: false, notNull: false, unique: false })) },
});

describe('layoutNodes', () => {
  const nodes = [node('a'), node('b')];
  const edges: DiagramEdge[] = [{ id: 'e', source: 'a', target: 'b', sourceHandle: 'c0', targetHandle: 'c0', data: { relation: '*-1' } }];

  it('keeps saved positions and computes the rest', () => {
    const out = layoutNodes(nodes, edges, { a: { x: 500, y: 500 } });
    expect(out).toHaveLength(2);
    expect(out.find((n) => n.id === 'a')!.position).toEqual({ x: 500, y: 500 });
    expect(out.find((n) => n.id === 'b')!.position).toBeDefined();
  });
  it('gives unsaved nodes distinct positions', () => {
    const out = layoutNodes(nodes, edges, {});
    const [a, b] = ['a', 'b'].map((id) => out.find((n) => n.id === id)!.position);
    expect(a.x !== b.x || a.y !== b.y).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/tools/draw/layout.lib.test.ts`
Expected: FAIL — cannot resolve `./layout.lib`.

- [ ] **Step 3: Write layout.lib**

Create `src/tools/draw/layout.lib.ts`:

```ts
import dagre from '@dagrejs/dagre';
import type { DiagramNode, DiagramEdge } from './dbml.lib';

export type PositionedNode = DiagramNode & { position: { x: number; y: number } };

const COL_HEIGHT = 26;
const HEADER = 40;
const NODE_WIDTH = 220;

/** Position nodes: saved positions win; the rest are laid out left-to-right with dagre. */
export function layoutNodes(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  saved: Record<string, { x: number; y: number }>,
): PositionedNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: HEADER + n.data.columns.length * COL_HEIGHT });
  }
  for (const e of edges) {
    if (nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target)) {
      g.setEdge(e.source, e.target);
    }
  }
  dagre.layout(g);
  return nodes.map((n) => {
    if (saved[n.id]) return { ...n, position: saved[n.id] };
    const p = g.node(n.id);
    // dagre centers nodes; shift to top-left origin for react-flow.
    return { ...n, position: { x: Math.round(p.x - NODE_WIDTH / 2), y: Math.round(p.y - (HEADER + n.data.columns.length * COL_HEIGHT) / 2) } };
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- --run src/tools/draw/layout.lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/draw/layout.lib.ts src/tools/draw/layout.lib.test.ts
git commit -m "feat(dbdiagram): dagre auto-layout preserving saved node positions"
```

---

## Task 4: SQL export (native + custom dialects)

**Files:**
- Create: `src/tools/draw/sql-export.lib.ts`
- Test: `src/tools/draw/sql-export.lib.test.ts`

**Interfaces:**
- Consumes: `@dbml/core` (`exporter.export`, `Parser`); `parseDbml` (Task 2).
- Produces:
  - `type Dialect = 'postgres' | 'mysql' | 'mssql' | 'oracle' | 'sqlite' | 'clickhouse'`
  - `exportSql(source: string, dialect: Dialect): string`
  - `const DIALECTS: { key: Dialect; label: string }[]`

- [ ] **Step 1: Write the failing test**

Create `src/tools/draw/sql-export.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { exportSql } from './sql-export.lib';

const SCHEMA = `
Table users {
  id int [pk, increment]
  email varchar [not null]
}
Table posts {
  id int [pk]
  user_id int
}
Ref: posts.user_id > users.id
`;

describe('exportSql — native dialects', () => {
  it('postgres emits CREATE TABLE and a foreign key', () => {
    const sql = exportSql(SCHEMA, 'postgres');
    expect(sql).toMatch(/create table/i);
    expect(sql).toMatch(/foreign key|references/i);
  });
});

describe('exportSql — sqlite (custom)', () => {
  it('uses SQLite affinities, AUTOINCREMENT, and no schema prefix', () => {
    const sql = exportSql(SCHEMA, 'sqlite');
    expect(sql).toMatch(/create table\s+"?users"?/i);
    expect(sql).toMatch(/integer/i);
    expect(sql).toMatch(/autoincrement/i);
    expect(sql).not.toMatch(/public\./i);
    expect(sql).toMatch(/foreign key/i);
  });
});

describe('exportSql — clickhouse (custom)', () => {
  it('uses MergeTree and ORDER BY, and omits foreign keys', () => {
    const sql = exportSql(SCHEMA, 'clickhouse');
    expect(sql).toMatch(/engine\s*=\s*mergetree/i);
    expect(sql).toMatch(/order by/i);
    expect(sql).not.toMatch(/foreign key/i);
  });
});

describe('exportSql — errors', () => {
  it('throws on an unknown dialect', () => {
    // @ts-expect-error deliberately invalid
    expect(() => exportSql(SCHEMA, 'db2')).toThrow();
  });
  it('throws on invalid DBML', () => {
    expect(() => exportSql('Table {{{', 'sqlite')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/tools/draw/sql-export.lib.test.ts`
Expected: FAIL — cannot resolve `./sql-export.lib`.

- [ ] **Step 3: Write sql-export.lib**

Create `src/tools/draw/sql-export.lib.ts`:

```ts
import { exporter, Parser } from '@dbml/core';
import { parseDbml } from './dbml.lib';

export type Dialect = 'postgres' | 'mysql' | 'mssql' | 'oracle' | 'sqlite' | 'clickhouse';

export const DIALECTS: { key: Dialect; label: string }[] = [
  { key: 'postgres', label: 'PostgreSQL' },
  { key: 'mysql', label: 'MySQL' },
  { key: 'mssql', label: 'SQL Server' },
  { key: 'oracle', label: 'Oracle' },
  { key: 'sqlite', label: 'SQLite' },
  { key: 'clickhouse', label: 'ClickHouse' },
];

const NATIVE = new Set<Dialect>(['postgres', 'mysql', 'mssql', 'oracle']);

/** Export DBML source to SQL for the given dialect. Throws on invalid DBML or unknown dialect. */
export function exportSql(source: string, dialect: Dialect): string {
  if (!DIALECTS.some((d) => d.key === dialect)) throw new Error(`Unknown dialect: ${dialect}`);
  if (NATIVE.has(dialect)) {
    // exporter.export takes DBML text directly and throws on parse errors.
    return exporter.export(source, dialect);
  }
  const { db, error } = parseDbml(source);
  if (error || !db) throw new Error(error ?? 'Invalid DBML');
  return dialect === 'sqlite' ? generateSqlite(db) : generateClickhouse(db);
}

// ---- Custom generators (shapes per the model-shape note in Global Constraints) ----
interface RawField { name: string; type?: { type_name?: string }; pk?: boolean; not_null?: boolean; unique?: boolean; increment?: boolean }
interface RawTable { name: string; fields?: RawField[] }
interface RawEndpoint { tableName?: string; fieldNames?: string[]; fields?: { name: string }[]; relation?: string }
interface RawRef { endpoints?: RawEndpoint[] }
interface RawSchema { tables?: RawTable[]; refs?: RawRef[] }

const epField = (ep: RawEndpoint) => ep.fieldNames?.[0] ?? ep.fields?.[0]?.name ?? '';
const schemasOf = (db: unknown): RawSchema[] => ((db as { schemas?: RawSchema[] }).schemas ?? []);

/** Map a DBML column type to a SQLite affinity. */
function sqliteType(t: string): string {
  const s = t.toLowerCase();
  if (/int|serial/.test(s)) return 'INTEGER';
  if (/char|text|clob|uuid|json|date|time/.test(s)) return 'TEXT';
  if (/real|floa|doub|dec|num/.test(s)) return 'REAL';
  if (/blob|binary|bytea/.test(s)) return 'BLOB';
  return 'TEXT';
}

function generateSqlite(db: unknown): string {
  const out: string[] = [];
  for (const schema of schemasOf(db)) {
    for (const table of schema.tables ?? []) {
      const lines: string[] = [];
      for (const f of table.fields ?? []) {
        const type = sqliteType(f.type?.type_name ?? '');
        let line = `  "${f.name}" ${type}`;
        if (f.pk) line += type === 'INTEGER' && f.increment ? ' PRIMARY KEY AUTOINCREMENT' : ' PRIMARY KEY';
        if (f.not_null && !f.pk) line += ' NOT NULL';
        if (f.unique && !f.pk) line += ' UNIQUE';
        lines.push(line);
      }
      // Foreign keys from refs whose FK side is this table.
      for (const ref of schema.refs ?? []) {
        const [a, b] = ref.endpoints ?? [];
        if (!a || !b) continue;
        const fk = a.relation === '*' || b.relation === '1' ? a : b;
        const pk = fk === a ? b : a;
        if (fk.tableName === table.name) {
          lines.push(`  FOREIGN KEY ("${epField(fk)}") REFERENCES "${pk.tableName}" ("${epField(pk)}")`);
        }
      }
      out.push(`CREATE TABLE "${table.name}" (\n${lines.join(',\n')}\n);`);
    }
  }
  return out.join('\n\n') + '\n';
}

/** Map a DBML column type to a ClickHouse type. */
function clickhouseType(t: string): string {
  const s = t.toLowerCase();
  if (/bigint|int8/.test(s)) return 'Int64';
  if (/int/.test(s)) return 'Int32';
  if (/bool/.test(s)) return 'UInt8';
  if (/real|floa|doub|dec|num/.test(s)) return 'Float64';
  if (/datetime|timestamp/.test(s)) return 'DateTime';
  if (/date/.test(s)) return 'Date';
  return 'String';
}

function generateClickhouse(db: unknown): string {
  const out: string[] = [];
  for (const schema of schemasOf(db)) {
    for (const table of schema.tables ?? []) {
      const fields = table.fields ?? [];
      const lines = fields.map((f) => {
        const base = clickhouseType(f.type?.type_name ?? '');
        const type = f.not_null || f.pk ? base : `Nullable(${base})`;
        return `  "${f.name}" ${type}`;
      });
      const pkCols = fields.filter((f) => f.pk).map((f) => `"${f.name}"`);
      const orderBy = pkCols.length ? `(${pkCols.join(', ')})` : 'tuple()';
      out.push(
        `-- ClickHouse has no FOREIGN KEY constraints; relationships are enforced by the application.\n` +
          `CREATE TABLE "${table.name}" (\n${lines.join(',\n')}\n)\nENGINE = MergeTree()\nORDER BY ${orderBy};`,
      );
    }
  }
  return out.join('\n\n') + '\n';
}
```

Note: `Parser` is imported for parity with `dbml.lib` usage but the native path uses `exporter.export` (which parses internally); if your linter flags the unused import, drop `Parser` from the import.

- [ ] **Step 4: Run to verify it passes (adjust accessors if needed)**

Run: `npm test -- --run src/tools/draw/sql-export.lib.test.ts`
Expected: PASS. If the sqlite/clickhouse assertions fail on a flag, apply the same one-time model-inspection step from Task 2 Step 4 and adjust the `RawField` accessors.

- [ ] **Step 5: Commit**

```bash
git add src/tools/draw/sql-export.lib.ts src/tools/draw/sql-export.lib.test.ts
git commit -m "feat(dbdiagram): SQL export (native pg/mysql/mssql/oracle + custom sqlite/clickhouse)"
```

---

## Task 5: Image export

**Files:**
- Create: `src/tools/draw/diagram-image.lib.ts`
- Test: `src/tools/draw/diagram-image.lib.test.ts`

**Interfaces:**
- Consumes: `html-to-image` (`toPng`, `toJpeg`, `toSvg`, `toCanvas`).
- Produces:
  - `type ImageFormat = 'png' | 'jpeg' | 'webp' | 'svg'`
  - `mimeFor(format: ImageFormat): string`
  - `pixelRatioFor(scale: number): number`
  - `exportDiagramImage(el: HTMLElement, opts: { format: ImageFormat; scale?: number; background?: string }): Promise<Blob>`

Only the two pure mapping functions are unit-tested; `exportDiagramImage` needs a real DOM/canvas and is verified manually via the island (Task 10).

- [ ] **Step 1: Write the failing test**

Create `src/tools/draw/diagram-image.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mimeFor, pixelRatioFor } from './diagram-image.lib';

describe('mimeFor', () => {
  it('maps each format to its MIME type', () => {
    expect(mimeFor('png')).toBe('image/png');
    expect(mimeFor('jpeg')).toBe('image/jpeg');
    expect(mimeFor('webp')).toBe('image/webp');
    expect(mimeFor('svg')).toBe('image/svg+xml');
  });
});

describe('pixelRatioFor', () => {
  it('clamps scale into 1..3', () => {
    expect(pixelRatioFor(2)).toBe(2);
    expect(pixelRatioFor(0)).toBe(1);
    expect(pixelRatioFor(9)).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/tools/draw/diagram-image.lib.test.ts`
Expected: FAIL — cannot resolve `./diagram-image.lib`.

- [ ] **Step 3: Write diagram-image.lib**

Create `src/tools/draw/diagram-image.lib.ts`:

```ts
import { toPng, toJpeg, toSvg, toCanvas } from 'html-to-image';

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'svg';

export function mimeFor(format: ImageFormat): string {
  return format === 'svg' ? 'image/svg+xml' : `image/${format}`;
}

export function pixelRatioFor(scale: number): number {
  return Math.min(3, Math.max(1, Math.round(scale) || 1));
}

/**
 * Render a DOM element (the react-flow viewport, pre-fitted to full bounds by
 * the caller) to an image blob. PNG/JPEG/SVG via html-to-image; WebP via canvas.
 */
export async function exportDiagramImage(
  el: HTMLElement,
  opts: { format: ImageFormat; scale?: number; background?: string },
): Promise<Blob> {
  const pixelRatio = pixelRatioFor(opts.scale ?? 1);
  const bg = opts.background ?? '#ffffff';

  if (opts.format === 'svg') {
    const dataUrl = await toSvg(el, { backgroundColor: bg });
    const res = await fetch(dataUrl);
    return res.blob();
  }
  if (opts.format === 'png') {
    const dataUrl = await toPng(el, { pixelRatio, backgroundColor: bg });
    return (await fetch(dataUrl)).blob();
  }
  if (opts.format === 'jpeg') {
    const dataUrl = await toJpeg(el, { pixelRatio, quality: 0.95, backgroundColor: bg });
    return (await fetch(dataUrl)).blob();
  }
  // webp: render to a canvas, then encode.
  const canvas = await toCanvas(el, { pixelRatio, backgroundColor: bg });
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode WebP'))), 'image/webp', 0.95),
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- --run src/tools/draw/diagram-image.lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/draw/diagram-image.lib.ts src/tools/draw/diagram-image.lib.test.ts
git commit -m "feat(dbdiagram): image export (png/jpeg/webp/svg) with scale mapping"
```

---

## Task 6: IndexedDB persistence store

**Files:**
- Create: `src/tools/draw/dbdiagram.store.ts`

**Interfaces:**
- Consumes: `idb`.
- Produces:
  - `type DbDiagramDoc = { dbml: string; positions: Record<string, { x: number; y: number }>; updatedAt: number }`
  - `loadDoc(): Promise<DbDiagramDoc | null>`
  - `saveDoc(doc: DbDiagramDoc): Promise<void>`

Mirrors `whiteboard.store.ts` exactly; no unit test (same untested pattern as the Whiteboard store — verified via the island).

- [ ] **Step 1: Create the store**

Create `src/tools/draw/dbdiagram.store.ts`:

```ts
import { openDB, type IDBPDatabase } from 'idb';

// Persist the DB diagram (DBML text + dragged node positions) locally so it
// survives reloads. IndexedDB (not localStorage) for consistency with other tools.
export interface DbDiagramDoc {
  dbml: string;
  positions: Record<string, { x: number; y: number }>;
  updatedAt: number;
}

const DB_NAME = 'gwt-dbdiagram';
const STORE = 'doc';
const KEY = 'current';

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

export async function loadDoc(): Promise<DbDiagramDoc | null> {
  try {
    return (await (await db()).get(STORE, KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function saveDoc(doc: DbDiagramDoc): Promise<void> {
  try {
    await (await db()).put(STORE, doc, KEY);
  } catch {
    /* storage unavailable / quota — best-effort */
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/tools/draw/dbdiagram.store.ts
git commit -m "feat(dbdiagram): IndexedDB persistence for DBML + node positions"
```

---

## Task 7: Custom diagram node & edge components

**Files:**
- Create: `src/islands/draw/db-diagram/TableNode.tsx`, `src/islands/draw/db-diagram/RelationEdge.tsx`

**Interfaces:**
- Consumes: `@xyflow/react` (`Handle`, `Position`, `NodeProps`, `EdgeProps`, `BaseEdge`, `getBezierPath`); `TableColumn` (Task 2).
- Produces: default-exported `TableNode` and `RelationEdge` React components + a `HIGHLIGHT` config object (exported from `TableNode.tsx`) used by both the nodes/edges and the island.

- [ ] **Step 1: Create the HIGHLIGHT config + TableNode**

Create `src/islands/draw/db-diagram/TableNode.tsx`:

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KeyRound, Link2 } from 'lucide-react';
import type { TableColumn } from '@/tools/draw/dbml.lib';

// Central, tunable emphasis config — bolder than dbdiagram.io's defaults.
export const HIGHLIGHT = {
  edgeWidth: 3.5,
  edgeWidthIdle: 1.5,
  color: 'var(--accent, #f59e0b)',
  glow: 'drop-shadow(0 0 4px var(--accent, #f59e0b))',
  dimOpacity: 0.25,
  nodeBorderWidth: 2.5,
};

export interface TableNodeData {
  name: string;
  columns: TableColumn[];
  /** injected by the island on hover: 'active' | 'neighbor' | 'dim' | undefined */
  emphasis?: 'active' | 'neighbor' | 'dim';
  /** set of `${column}` names to highlight (FK/PK endpoints) */
  hotColumns?: Set<string>;
}

export default function TableNode({ data }: NodeProps<{ data: TableNodeData } & Record<string, unknown>> & { data: TableNodeData }) {
  const emphasized = data.emphasis === 'active' || data.emphasis === 'neighbor';
  const style: React.CSSProperties = {
    opacity: data.emphasis === 'dim' ? HIGHLIGHT.dimOpacity : 1,
    borderWidth: emphasized ? HIGHLIGHT.nodeBorderWidth : 2,
    borderColor: emphasized ? HIGHLIGHT.color : undefined,
    filter: data.emphasis === 'active' ? HIGHLIGHT.glow : undefined,
    transition: 'opacity 120ms, border-color 120ms, filter 120ms',
  };

  return (
    <div className="min-w-[200px] border-2 border-border bg-background text-sm shadow-brutal-sm" style={style}>
      <div className="border-b-2 border-border bg-muted px-3 py-1.5 font-bold">{data.name}</div>
      <div>
        {data.columns.map((c) => {
          const hot = data.hotColumns?.has(c.name);
          return (
            <div
              key={c.name}
              className="relative flex items-center justify-between gap-3 px-3 py-1"
              style={hot ? { background: HIGHLIGHT.color, color: '#000' } : undefined}
            >
              {/* Column-level handles (both sides) so edges attach at the row. */}
              <Handle type="target" position={Position.Left} id={c.name} style={{ opacity: 0 }} />
              <span className="flex items-center gap-1 font-mono">
                {c.pk && <KeyRound className="h-3 w-3" />}
                {c.fk && !c.pk && <Link2 className="h-3 w-3" />}
                {c.name}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{c.type}</span>
              <Handle type="source" position={Position.Right} id={c.name} style={{ opacity: 0 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create RelationEdge**

Create `src/islands/draw/db-diagram/RelationEdge.tsx`:

```tsx
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { HIGHLIGHT } from './TableNode';

export interface RelationEdgeData {
  emphasis?: 'active' | 'dim';
}

export default function RelationEdge(props: EdgeProps & { data?: RelationEdgeData }) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const active = data?.emphasis === 'active';
  const dim = data?.emphasis === 'dim';
  return (
    <BaseEdge
      id={props.id}
      path={path}
      style={{
        stroke: active ? HIGHLIGHT.color : 'var(--border, #999)',
        strokeWidth: active ? HIGHLIGHT.edgeWidth : HIGHLIGHT.edgeWidthIdle,
        strokeDasharray: active ? '6 3' : undefined,
        opacity: dim ? HIGHLIGHT.dimOpacity : 1,
        filter: active ? HIGHLIGHT.glow : undefined,
        transition: 'stroke 120ms, stroke-width 120ms, opacity 120ms',
      }}
    />
  );
}
```

- [ ] **Step 3: Verify compile**

Run: `npm run build`
Expected: build succeeds (components unused until Task 8; must type-check). If `@xyflow/react`'s `NodeProps`/`EdgeProps` generics complain, relax the node prop type to `NodeProps` and read `data` via `props.data as TableNodeData` — the runtime contract is what matters.

- [ ] **Step 4: Commit**

```bash
git add src/islands/draw/db-diagram/TableNode.tsx src/islands/draw/db-diagram/RelationEdge.tsx
git commit -m "feat(dbdiagram): custom TableNode + RelationEdge with HIGHLIGHT config"
```

---

## Task 8: The island — editor ↔ diagram render + persistence

**Files:**
- Create: `src/islands/draw/DbDiagram.tsx`
- Modify: `src/registry/tools.ts`

**Interfaces:**
- Consumes: `parseDbml`, `buildFlow` (Task 2); `layoutNodes` (Task 3); `loadDoc`, `saveDoc`, `DbDiagramDoc` (Task 6); `TableNode`, `RelationEdge` (Task 7); `@xyflow/react` (`ReactFlow`, `Background`, `Controls`, `MiniMap`, `applyNodeChanges`); `@xyflow/react/dist/style.css`.
- Produces: default-exported `DbDiagram` island.

- [ ] **Step 1: Create the island (core: editor, diagram, persistence, seed)**

Create `src/islands/draw/DbDiagram.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { parseDbml, buildFlow } from '@/tools/draw/dbml.lib';
import { layoutNodes } from '@/tools/draw/layout.lib';
import { loadDoc, saveDoc, type DbDiagramDoc } from '@/tools/draw/dbdiagram.store';
import TableNode from './db-diagram/TableNode';
import RelationEdge from './db-diagram/RelationEdge';
import { Alert } from '@/components/ui/Alert';
import '@xyflow/react/dist/style.css';

const SEED = `Table users {
  id int [pk, increment]
  email varchar [not null, unique]
  created_at timestamp
}

Table posts {
  id int [pk, increment]
  user_id int [not null]
  title varchar
  body text
}

Ref: posts.user_id > users.id
`;

const nodeTypes = { table: TableNode };
const edgeTypes = { relation: RelationEdge };

export default function DbDiagram() {
  // react-flow is browser-only and heavy — load it after mount (like Whiteboard).
  const [RF, setRF] = useState<{
    ReactFlow: ComponentType<Record<string, unknown>>;
    Background: ComponentType<Record<string, unknown>>;
    Controls: ComponentType<Record<string, unknown>>;
    MiniMap: ComponentType<Record<string, unknown>>;
    applyNodeChanges: (changes: unknown[], nodes: unknown[]) => unknown[];
  } | null>(null);

  const [dbml, setDbml] = useState(SEED);
  const [nodes, setNodes] = useState<Record<string, unknown>[]>([]);
  const [edges, setEdges] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const positions = useRef<Record<string, { x: number; y: number }>>({});
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    import('@xyflow/react').then((m) => {
      if (!alive) return;
      setRF({
        ReactFlow: m.ReactFlow as ComponentType<Record<string, unknown>>,
        Background: m.Background as ComponentType<Record<string, unknown>>,
        Controls: m.Controls as ComponentType<Record<string, unknown>>,
        MiniMap: m.MiniMap as ComponentType<Record<string, unknown>>,
        applyNodeChanges: m.applyNodeChanges as (c: unknown[], n: unknown[]) => unknown[],
      });
    });
    return () => { alive = false; };
  }, []);

  // Load persisted doc once.
  useEffect(() => {
    loadDoc().then((doc) => {
      if (doc) {
        positions.current = doc.positions ?? {};
        setDbml(doc.dbml || SEED);
      }
      loaded.current = true;
    });
  }, []);

  // Re-parse + re-render whenever DBML changes (debounced). Keep the last good
  // diagram on parse errors so the user doesn't lose context mid-typo.
  useEffect(() => {
    const t = setTimeout(() => {
      const { db, error: err } = parseDbml(dbml);
      setError(err);
      if (err) return; // keep previous nodes/edges
      const flow = buildFlow(db);
      const positioned = layoutNodes(flow.nodes, flow.edges, positions.current);
      setNodes(positioned as unknown as Record<string, unknown>[]);
      setEdges(flow.edges.map((e) => ({ ...e, type: 'relation' })) as unknown as Record<string, unknown>[]);
    }, 400);
    return () => clearTimeout(t);
  }, [dbml]);

  // Debounced autosave of DBML + positions.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      void saveDoc({ dbml, positions: positions.current, updatedAt: Date.now() } satisfies DbDiagramDoc);
    }, 800);
    return () => clearTimeout(t);
  }, [dbml, nodes]);

  const onNodesChange = useCallback(
    (changes: unknown[]) => {
      if (!RF) return;
      setNodes((ns) => {
        const next = RF.applyNodeChanges(changes, ns) as { id: string; position: { x: number; y: number } }[];
        // Record dragged positions so re-parses preserve them.
        for (const n of next) positions.current[n.id] = n.position;
        return next as unknown as Record<string, unknown>[];
      });
    },
    [RF],
  );

  const diagram = useMemo(() => {
    if (!RF) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading diagram…</div>;
    const { ReactFlow, Background, Controls, MiniMap } = RF;
    return (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        fitView
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    );
  }, [RF, nodes, edges, onNodesChange]);

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Write your schema in <a href="https://dbml.dbdiagram.io/docs/" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">DBML</a> on the left; the ER diagram updates live. Drag tables to arrange them — your layout and schema are saved in your browser.
      </p>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_3fr]">
        <textarea
          value={dbml}
          onChange={(e) => setDbml(e.target.value)}
          spellCheck={false}
          className="h-[75vh] w-full resize-none border-2 border-border bg-background p-3 font-mono text-xs leading-relaxed"
        />
        <div className="h-[75vh] w-full overflow-hidden border-2 border-border">{diagram}</div>
      </div>
    </div>
  );
}
```

Note: the plan uses a `<textarea>` for the editor to keep Task 8 self-contained and dependency-light. A later optional enhancement can swap in the app's self-hosted Monaco; the spec allows plain-text editing for v1.

- [ ] **Step 2: Register the tool**

In `src/registry/tools.ts`, `Database` is already imported. Add:

```ts
  {
    id: 'db-diagram',
    name: 'DB Diagram',
    category: 'Draw',
    route: '/tools/db-diagram',
    keywords: ['dbml', 'erd', 'er diagram', 'schema', 'database', 'diagram', 'sql', 'tables'],
    icon: Database,
    summary: 'Design database schemas in DBML with a live ER diagram, SQL and image export',
    load: () => import('@/islands/draw/DbDiagram'),
    status: 'beta'
  },
```

- [ ] **Step 3: Verify build + route**

Run: `npm run build`
Expected: build succeeds; `/tools/db-diagram` generated. If the Astro/Vite SSR build errors on `@xyflow/react` importing browser globals at module scope, confirm the CSS import and component imports are fine (the `ReactFlow` component itself is only pulled in via dynamic `import()` after mount, so SSR shouldn't evaluate it).

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open `/tools/db-diagram`. Expected: seed schema renders two tables + one edge; editing DBML updates the diagram; dragging a table and reloading preserves its position; zoom/minimap/controls work.

- [ ] **Step 5: Commit**

```bash
git add src/islands/draw/DbDiagram.tsx src/registry/tools.ts
git commit -m "feat(dbdiagram): live DBML editor + react-flow ER diagram with persistence"
```

---

## Task 9: Bold hover-highlight

**Files:**
- Modify: `src/islands/draw/DbDiagram.tsx`

**Interfaces:**
- Consumes: `HIGHLIGHT` (Task 7) indirectly (via the node/edge `emphasis` prop); react-flow `onNodeMouseEnter`/`onNodeMouseLeave`.

- [ ] **Step 1: Add hover state and emphasis derivation**

In `src/islands/draw/DbDiagram.tsx`, add a `hoveredId` state and derive per-node/per-edge `emphasis` + per-node `hotColumns` from it, without mutating the base nodes/edges. Add near the other state:

```tsx
  const [hoveredId, setHoveredId] = useState<string | null>(null);
```

Add these handlers (inside the component, before `diagram`):

```tsx
  const onNodeMouseEnter = useCallback((_e: unknown, node: { id: string }) => setHoveredId(node.id), []);
  const onNodeMouseLeave = useCallback(() => setHoveredId(null), []);
```

- [ ] **Step 2: Compute emphasized nodes/edges**

Replace the `diagram` `useMemo` body's `nodes={nodes}` / `edges={edges}` with derived, emphasis-annotated copies. Add this computation just above the `return` inside the `useMemo` (and add `hoveredId` to its dependency array):

```tsx
    // Derive hover emphasis: connected edges + neighbour tables pop; the rest dim.
    const connEdges = hoveredId ? (edges as { id: string; source: string; target: string; sourceHandle: string; targetHandle: string }[]).filter((e) => e.source === hoveredId || e.target === hoveredId) : [];
    const neighbours = new Set<string>();
    const hotByTable: Record<string, Set<string>> = {};
    for (const e of connEdges) {
      neighbours.add(e.source);
      neighbours.add(e.target);
      (hotByTable[e.source] ??= new Set()).add(e.sourceHandle);
      (hotByTable[e.target] ??= new Set()).add(e.targetHandle);
    }
    const connIds = new Set(connEdges.map((e) => e.id));

    const dispNodes = (nodes as { id: string; data: Record<string, unknown> }[]).map((n) => {
      if (!hoveredId) return n;
      const emphasis = n.id === hoveredId ? 'active' : neighbours.has(n.id) ? 'neighbor' : 'dim';
      return { ...n, data: { ...n.data, emphasis, hotColumns: hotByTable[n.id] } };
    });
    const dispEdges = (edges as { id: string; data?: Record<string, unknown> }[]).map((e) => {
      if (!hoveredId) return e;
      const emphasis = connIds.has(e.id) ? 'active' : 'dim';
      return { ...e, data: { ...(e.data ?? {}), emphasis } };
    });
```

Then use `dispNodes`/`dispEdges` in the `<ReactFlow>` props and add the hover handlers:

```tsx
      <ReactFlow
        nodes={dispNodes}
        edges={dispEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
```

Update the `useMemo` dependency array to `[RF, nodes, edges, onNodesChange, hoveredId, onNodeMouseEnter, onNodeMouseLeave]`.

- [ ] **Step 3: Verify build + manual hover check**

Run: `npm run build && npm run dev`
Expected: build succeeds. Hovering a table thickens + glows its relationship edges (amber), accent-borders the connected tables, highlights the FK/PK endpoint columns, and dims everything else; leaving restores the view.

- [ ] **Step 4: Commit**

```bash
git add src/islands/draw/DbDiagram.tsx
git commit -m "feat(dbdiagram): bold hover-highlight for table relationships"
```

---

## Task 10: Toolbar — SQL export + image export

**Files:**
- Modify: `src/islands/draw/DbDiagram.tsx`

**Interfaces:**
- Consumes: `exportSql`, `DIALECTS`, `Dialect` (Task 4); `exportDiagramImage`, `ImageFormat` (Task 5); `downloadService` (`@/services/download`); `ImageResult` (`@/components/ui/ImageResult`); `Button`; react-flow's `getNodesBounds`/`getViewportForBounds` (imported from `@xyflow/react`).

- [ ] **Step 1: Add SQL export UI**

In `src/islands/draw/DbDiagram.tsx`, add imports:

```tsx
import { Button } from '@/components/ui/Button';
import { ImageResult } from '@/components/ui/ImageResult';
import { downloadService } from '@/services/download';
import { exportSql, DIALECTS, type Dialect } from '@/tools/draw/sql-export.lib';
import { exportDiagramImage, type ImageFormat } from '@/tools/draw/diagram-image.lib';
```

Add state:

```tsx
  const [dialect, setDialect] = useState<Dialect>('postgres');
  const [sql, setSql] = useState<string | null>(null);
  const [sqlErr, setSqlErr] = useState<string | null>(null);
  const [imgFormat, setImgFormat] = useState<ImageFormat>('png');
  const [imgScale, setImgScale] = useState(2);
  const [imgBlob, setImgBlob] = useState<Blob | null>(null);
  const flowWrapper = useRef<HTMLDivElement | null>(null);
```

Add handlers:

```tsx
  const runSqlExport = () => {
    setSqlErr(null);
    setSql(null);
    try {
      setSql(exportSql(dbml, dialect));
    } catch (e) {
      setSqlErr(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const runImageExport = async () => {
    // Export the whole diagram: html-to-image captures the react-flow viewport DOM.
    const el = flowWrapper.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    const target = el ?? flowWrapper.current;
    if (!target) return;
    setImgBlob(await exportDiagramImage(target, { format: imgFormat, scale: imgScale }));
  };
```

- [ ] **Step 2: Attach the wrapper ref and render the toolbar**

Wrap the diagram container with the ref:

```tsx
        <div ref={flowWrapper} className="h-[75vh] w-full overflow-hidden border-2 border-border">{diagram}</div>
```

Add a toolbar above the grid (below the intro `<p>`):

```tsx
      <div className="flex flex-wrap items-end gap-4 border-2 border-border bg-muted/40 p-3">
        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">SQL dialect</span>
          <select value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            {DIALECTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <Button onClick={runSqlExport} disabled={!!error}>Export SQL</Button>

        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Image</span>
          <select value={imgFormat} onChange={(e) => setImgFormat(e.target.value as ImageFormat)} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
            <option value="svg">SVG</option>
          </select>
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Scale</span>
          <select value={imgScale} onChange={(e) => setImgScale(Number(e.target.value))} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            <option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option>
          </select>
        </div>
        <Button variant="secondary" onClick={runImageExport}>Export image</Button>
      </div>
```

- [ ] **Step 3: Render the export results**

Add below the grid:

```tsx
      {sqlErr && <Alert variant="error">{sqlErr}</Alert>}
      {sql && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(sql)}>Copy SQL</Button>
            <Button variant="secondary" onClick={() => downloadService.download(new Blob([sql], { type: 'text/sql' }), `schema-${dialect}.sql`)}>Download .sql</Button>
          </div>
          <pre className="max-h-[40vh] overflow-auto border-2 border-border bg-background p-3 font-mono text-xs">{sql}</pre>
        </div>
      )}
      {imgBlob && <ImageResult blob={imgBlob} filename={`db-diagram.${imgFormat === 'jpeg' ? 'jpg' : imgFormat}`} />}
```

(The `ImageResult` gives the exported diagram Download/Copy/**Edit in Annotator** automatically once Plan A's handoff button is in `ResultActions`.)

- [ ] **Step 4: Verify build + manual export check**

Run: `npm run build && npm run dev`
Expected: build succeeds. In the tool: choose PostgreSQL → Export SQL shows `CREATE TABLE …`; switch to SQLite/ClickHouse → dialect-specific SQL; Export image (PNG/JPEG/WebP/SVG at 1×/2×/3×) produces a downloadable image of the full diagram.

- [ ] **Step 5: Commit**

```bash
git add src/islands/draw/DbDiagram.tsx
git commit -m "feat(dbdiagram): SQL export + image export toolbar"
```

---

## Task 11: Excalidraw-style chrome (expand + hide-navbar)

**Files:**
- Modify: `src/islands/draw/DbDiagram.tsx`

**Interfaces:**
- Mirrors `Whiteboard.tsx`'s expand/hide-navbar mechanism (localStorage keys `gwt-dbdiagram-expanded`, `gwt-dbdiagram-navhidden`).

- [ ] **Step 1: Add expand + hide-navbar state and persistence**

In `src/islands/draw/DbDiagram.tsx`, add imports:

```tsx
import { Maximize2, Minimize2, ChevronUp, ChevronDown } from 'lucide-react';
```

Add state + persistence (mirroring Whiteboard):

```tsx
  const [expanded, setExpanded] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [navBottom, setNavBottom] = useState(67);

  const setExpandedPersist = (v: boolean) => { setExpanded(v); try { localStorage.setItem('gwt-dbdiagram-expanded', v ? '1' : '0'); } catch { /* ignore */ } };
  const setNavHiddenPersist = (v: boolean) => { setNavHidden(v); try { localStorage.setItem('gwt-dbdiagram-navhidden', v ? '1' : '0'); } catch { /* ignore */ } };

  useEffect(() => {
    if (localStorage.getItem('gwt-dbdiagram-expanded') === '1') setExpanded(true);
    if (localStorage.getItem('gwt-dbdiagram-navhidden') === '1') setNavHidden(true);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedPersist(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement | null;
    if (!header) return;
    header.style.display = expanded && navHidden ? 'none' : '';
    if (!expanded || navHidden) return () => { header.style.display = ''; };
    const measure = () => setNavBottom(Math.round(header.getBoundingClientRect().bottom || 0));
    measure();
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); header.style.display = ''; };
  }, [expanded, navHidden]);

  const topOffset = navHidden ? 0 : navBottom;
```

- [ ] **Step 2: Make the diagram container the expandable overlay**

Change the diagram wrapper so that, when `expanded`, it becomes a fixed overlay (the editor grid stays behind it). Replace the diagram wrapper element with:

```tsx
        <div
          ref={flowWrapper}
          className={expanded
            ? 'fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t-2 border-border bg-background'
            : 'h-[75vh] w-full overflow-hidden border-2 border-border'}
          style={expanded ? { top: topOffset } : undefined}
        >
          {diagram}
        </div>
```

Add an Expand button (near the toolbar) and, while expanded, the Exit button + hide-navbar pull-tab (mirroring Whiteboard):

```tsx
      {!expanded && (
        <Button variant="secondary" onClick={() => setExpandedPersist(true)}><Maximize2 className="h-4 w-4" />Expand</Button>
      )}
      {expanded && (
        <>
          <button
            onClick={() => setNavHiddenPersist(!navHidden)}
            title={navHidden ? 'Show navbar' : 'Hide navbar for more space'}
            aria-label={navHidden ? 'Show navbar' : 'Hide navbar'}
            className={`fixed left-1/2 z-50 -translate-x-1/2 rounded-b-md border-2 border-t-0 border-border bg-background px-5 py-0.5 shadow-brutal-sm hover:bg-muted ${navHidden ? '' : '-translate-y-full'}`}
            style={{ top: topOffset }}
          >
            {navHidden ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <div className="fixed right-4 z-40 flex items-center gap-3" style={{ top: topOffset + 8 }}>
            <Button variant="secondary" onClick={() => setExpandedPersist(false)} className="shadow-brutal"><Minimize2 className="h-4 w-4" />Exit</Button>
          </div>
        </>
      )}
```

Place the Expand button inside the toolbar row so it sits with the other controls.

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build && npm run dev`
Expected: build succeeds. Expand fills the viewport below the navbar; the pull-tab hides/shows the navbar; Esc/Exit collapses; the choices persist across reloads.

- [ ] **Step 4: Commit**

```bash
git add src/islands/draw/DbDiagram.tsx
git commit -m "feat(dbdiagram): expand + hide-navbar chrome (Whiteboard parity)"
```

---

## Task 12: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npm test -- --run`
Expected: all tests pass, including the new `dbml.lib`, `layout.lib`, `sql-export.lib`, `diagram-image.lib` suites.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds; the route exists:
```bash
ls dist/tools | grep db-diagram
```

- [ ] **Step 3: Full manual smoke test (dev server)**

Run: `npm run dev`, open `/tools/db-diagram`, verify end-to-end:
- Seed renders; editing DBML updates the diagram live; parse errors show a banner without blanking the diagram.
- Drag tables; positions persist across reload.
- Hover a table → bold amber glowing edges, accent table borders, FK/PK column highlight, others dimmed.
- SQL export across all six dialects (postgres/mysql/mssql/oracle/sqlite/clickhouse) → Copy + Download .sql.
- Image export PNG/JPEG/WebP/SVG at 1×/2×/3× → Download + "Edit in Annotator".
- Expand / hide-navbar / Esc.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "chore(dbdiagram): finalize DB Diagram tool"
```

---

## Self-Review

**1. Spec coverage:**
- DBML parse + node/edge model → Task 2. ✓
- dagre auto-layout preserving saved positions → Task 3. ✓
- SQL export (native pg/mysql/mssql/oracle + custom sqlite/clickhouse) → Task 4. ✓
- Image export PNG/JPEG/WebP/SVG at 1×/2×/3× → Task 5 + Task 10. ✓
- IndexedDB persistence (DBML + positions) → Task 6 + Task 8. ✓
- Custom TableNode/RelationEdge + tunable HIGHLIGHT → Task 7. ✓
- Live editor ↔ diagram, drag/zoom/pan/minimap → Task 8. ✓
- Bold hover-highlight (edges, endpoint columns, related-table borders, dim others) → Task 9. ✓
- SQL + image export toolbar wiring → Task 10. ✓
- Expand / hide-navbar chrome → Task 11. ✓
- Registry entry (Draw, beta) → Task 8. ✓
- Deps → Task 1. ✓

**2. Placeholder scan:** No TBD/TODO; every code step ships complete code; the one intentional deviation (textarea instead of Monaco for v1) is called out explicitly and permitted by the spec's "plain-text editing for v1" out-of-scope note. ✓

**3. Type consistency:** `DiagramNode`/`DiagramEdge`/`TableColumn` defined in Task 2 and consumed unchanged in Tasks 3, 7, 8, 9. `PositionedNode` (Task 3) fed into react-flow (Task 8). `HIGHLIGHT` exported from `TableNode.tsx` (Task 7) and consumed by `RelationEdge` (Task 7) + emphasis props (Task 9). `Dialect`/`DIALECTS` (Task 4) match the toolbar `<select>` (Task 10). `ImageFormat` (Task 5) matches the toolbar options (Task 10). `DbDiagramDoc` (Task 6) round-trips through `loadDoc`/`saveDoc` (Task 8). The `emphasis` union `'active'|'neighbor'|'dim'` (nodes) and `'active'|'dim'` (edges) match between Task 7's components and Task 9's derivation. ✓

**Cross-plan note:** The image-export `ImageResult` (Task 10) gains its "Edit in Annotator" button from Plan A (Image Tools & Annotator Handoff), Task 2. This plan is otherwise independent and can be built and shipped on its own; if built before Plan A, the exported diagram simply shows Download/Copy (no Annotator button) until Plan A lands.
