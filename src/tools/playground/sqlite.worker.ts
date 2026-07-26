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
    const rows: any[] = [];
    db.exec({
      sql: "SELECT type,name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
      rowMode: 'object',
      resultRows: rows,
    });
    // Drop triggers/views/indexes first, then tables.
    for (const order of ['trigger', 'view', 'index', 'table']) {
      for (const t of rows.filter((x) => x.type === order)) {
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
