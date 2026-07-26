import { exporter } from '@dbml/core';
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

// ---- Custom generators (shapes per the model-shape note in the plan) ----
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
        `-- ClickHouse has no FK/referential constraints; relationships are enforced by the application.\n` +
          `CREATE TABLE "${table.name}" (\n${lines.join(',\n')}\n)\nENGINE = MergeTree()\nORDER BY ${orderBy};`,
      );
    }
  }
  return out.join('\n\n') + '\n';
}
