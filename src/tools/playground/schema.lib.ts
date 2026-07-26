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
