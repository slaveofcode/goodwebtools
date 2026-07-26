// Mutating the DBML text (the source of truth) when a relationship is drawn or
// deleted on the canvas. Pure functions so they can be unit-tested; the island
// just feeds in the connected columns and swaps in the returned DBML.

export interface RefColumn {
  table: string;
  column: string;
  pk?: boolean;
  unique?: boolean;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex matching a `table.column` token, not a longer identifier (users.id ≠ users.identity). */
const tokenRe = (c: RefColumn) => new RegExp(`(?<![\\w.])${esc(c.table)}\\.${esc(c.column)}(?![\\w.])`);

const oneSide = (c: RefColumn) => !!(c.pk || c.unique);

/**
 * Choose the DBML operator + orientation for two connected columns.
 * `>` = many-to-one (FK on the left); `-` = one-to-one. The "one" side is a
 * primary-key/unique column; the FK (many) side is written on the left.
 */
function orient(from: RefColumn, to: RefColumn): { left: RefColumn; right: RefColumn; op: '>' | '-' } {
  const fromOne = oneSide(from);
  const toOne = oneSide(to);
  if (fromOne && toOne) return { left: from, right: to, op: '-' }; // unique↔unique → 1:1
  if (toOne) return { left: from, right: to, op: '>' }; // `to` is the PK/one side; `from` is the FK
  if (fromOne) return { left: to, right: from, op: '>' }; // `from` is the PK/one side; `to` is the FK
  return { left: from, right: to, op: '>' }; // neither is a key → default many→one in drag order
}

/** True if a standalone `Ref:` line already declares a relationship between these two columns. */
export function hasRef(dbml: string, a: RefColumn, b: RefColumn): boolean {
  const ra = tokenRe(a);
  const rb = tokenRe(b);
  return dbml.split('\n').some((line) => /^\s*Ref\b/i.test(line) && ra.test(line) && rb.test(line));
}

/**
 * Append a `Ref:` line for a relationship drawn between two columns. No-op if the
 * relationship already exists or the endpoints are the same column.
 */
export function addRef(dbml: string, from: RefColumn, to: RefColumn): string {
  if (from.table === to.table && from.column === to.column) return dbml;
  if (hasRef(dbml, from, to)) return dbml;
  const { left, right, op } = orient(from, to);
  const line = `Ref: ${left.table}.${left.column} ${op} ${right.table}.${right.column}`;
  const sep = dbml.length === 0 || dbml.endsWith('\n') ? '' : '\n';
  return `${dbml}${sep}${line}\n`;
}

/**
 * Remove the standalone `Ref:` line(s) declaring the relationship between two
 * columns (either direction/operator). Inline `[ref: …]` refs are left for the
 * DBML editor — canvas-created relationships are always standalone lines.
 */
export function removeRef(dbml: string, a: RefColumn, b: RefColumn): string {
  const ra = tokenRe(a);
  const rb = tokenRe(b);
  const lines = dbml.split('\n');
  const kept = lines.filter((line) => !(/^\s*Ref\b/i.test(line) && ra.test(line) && rb.test(line)));
  return kept.join('\n');
}
