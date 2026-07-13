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
