/**
 * Line/list set operations between two text sources. Pure and framework-free so
 * it is fully unit-tested; the island is a thin wrapper. Comparison is done on a
 * normalised "key" (optional trim + case-fold) while the *original* line text is
 * preserved in the output (first occurrence wins).
 */

export type LineSetMode =
  | 'union'         // merge & dedupe (A ∪ B)
  | 'difference'    // in A but not B (A − B)
  | 'differenceB'   // in B but not A (B − A)
  | 'intersection'  // B lines also found in A (A ∩ B, B-oriented)
  | 'symmetric'     // in only one list (A △ B)
  | 'duplicates';   // lines appearing 2+ times across A and B

export interface LineSetOptions {
  caseInsensitive?: boolean;
  trim?: boolean;
  ignoreBlank?: boolean;
  sort?: boolean;
}

export interface LineSetResult {
  lines: string[];
  count: number;
}

interface Entry { line: string; key: string }

function keyOf(line: string, opts: LineSetOptions): string {
  let s = opts.trim ? line.trim() : line;
  if (opts.caseInsensitive) s = s.toLowerCase();
  return s;
}

function prep(text: string, opts: LineSetOptions): Entry[] {
  const raw = text.length ? text.split(/\r\n|\r|\n/) : [];
  const out: Entry[] = [];
  for (const line of raw) {
    if (opts.ignoreBlank && line.trim() === '') continue;
    out.push({ line, key: keyOf(line, opts) });
  }
  return out;
}

/** Ordered de-dup: keep the first line for each key that passes `keep`. */
function uniqOrdered(items: Entry[], keep: (key: string) => boolean): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (keep(it.key) && !seen.has(it.key)) {
      seen.add(it.key);
      out.push(it.line);
    }
  }
  return out;
}

export function compareLines(a: string, b: string, mode: LineSetMode, opts: LineSetOptions): LineSetResult {
  const A = prep(a, opts);
  const B = prep(b, opts);
  const keysA = new Set(A.map((x) => x.key));
  const keysB = new Set(B.map((x) => x.key));

  let lines: string[];
  switch (mode) {
    case 'union':
      lines = uniqOrdered([...A, ...B], () => true);
      break;
    case 'difference':
      lines = uniqOrdered(A, (k) => !keysB.has(k));
      break;
    case 'differenceB':
      lines = uniqOrdered(B, (k) => !keysA.has(k));
      break;
    case 'intersection':
      lines = uniqOrdered(B, (k) => keysA.has(k));
      break;
    case 'symmetric':
      lines = [...uniqOrdered(A, (k) => !keysB.has(k)), ...uniqOrdered(B, (k) => !keysA.has(k))];
      break;
    case 'duplicates': {
      const counts = new Map<string, number>();
      for (const it of [...A, ...B]) counts.set(it.key, (counts.get(it.key) ?? 0) + 1);
      lines = uniqOrdered([...A, ...B], (k) => (counts.get(k) ?? 0) > 1);
      break;
    }
  }

  if (opts.sort) {
    lines = [...lines].sort((x, y) => keyOf(x, opts).localeCompare(keyOf(y, opts)));
  }
  return { lines, count: lines.length };
}
