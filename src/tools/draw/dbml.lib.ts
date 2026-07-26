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

// Loose shapes for the parsed model (see model-shape note in the plan).
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
