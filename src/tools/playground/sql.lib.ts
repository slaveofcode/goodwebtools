/**
 * Split a multi-statement SQL script on top-level semicolons, respecting single
 * ('), double (") and backtick (`) quoted spans, `--` line comments and
 * block comments. Returns trimmed, non-empty statements.
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
