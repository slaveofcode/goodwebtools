/**
 * JSON / YAML / TOML Viewer — pure helpers: parse with a readable error location, build
 * JSONPath-style paths ($.items[3].id), one-line previews for collapsed nodes,
 * document stats, and search that also returns the ancestors to auto-expand.
 */

import { parseAllDocuments } from 'yaml';
import { parse as parseTomlText } from 'smol-toml';
import JSON5 from 'json5';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Which flavour of JSON text was read. */
export type JsonVariant = 'json' | 'jsonl' | 'json5';

export type ParseResult =
  | { ok: true; value: JsonValue; variant?: JsonVariant; records?: number }
  | { ok: false; message: string; line?: number; column?: number };

/** JSON-family extensions: JSON Lines, JSON5/JSONC, and formats that are JSON inside. */
const JSONL_EXT = new Set(['jsonl', 'ndjson', 'ldjson', 'jsonlines']);
const JSON5_EXT = new Set(['json5', 'jsonc']);
const JSON_EXT = new Set(['json', 'geojson', 'topojson', 'har', 'ipynb', 'webmanifest', 'map', 'jsonld', 'gltf', 'avsc', 'babelrc', 'eslintrc', 'prettierrc']);

const extOf = (fileName: string) => /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';

/** 1-based line/column of a character offset. */
export function lineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

/**
 * Offset of the first JSON syntax error, or -1 if the text is valid. Browsers
 * don't always say where JSON.parse failed (recent Chrome often doesn't), so
 * this small iterative scanner finds it.
 */
export function jsonErrorOffset(text: string): number {
  let i = 0;
  const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i])) i++; };
  /** A string, number, true/false/null at i. */
  const scalar = (): boolean => {
    if (text[i] === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') {
          i++;
          if (text[i] === 'u') {
            if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) return false;
            i += 4;
          } else if (!'"\\/bfnrt'.includes(text[i] ?? '')) return false;
        } else if (text.charCodeAt(i) < 0x20) return false;
        i++;
      }
      if (text[i] !== '"') return false;
      i++;
      return true;
    }
    for (const lit of ['true', 'false', 'null']) if (text.startsWith(lit, i)) { i += lit.length; return true; }
    NUMBER.lastIndex = i;
    if (NUMBER.test(text)) { i = NUMBER.lastIndex; return true; }
    return false;
  };
  const stack: { kind: '{' | '['; n: number }[] = [];
  /** Any value; containers are opened and finished by the loop below. */
  const value = (): boolean => {
    ws();
    if (text[i] === '{' || text[i] === '[') { stack.push({ kind: text[i] as '{' | '[', n: 0 }); i++; return true; }
    return scalar();
  };

  if (!value()) return i;
  while (stack.length) {
    const top = stack[stack.length - 1];
    ws();
    if (text[i] === (top.kind === '{' ? '}' : ']')) { stack.pop(); i++; continue; }
    if (top.n > 0) {
      if (text[i] !== ',') return i;
      i++;
      ws();
    }
    if (top.kind === '{') {
      if (text[i] !== '"' || !scalar()) return i;
      ws();
      if (text[i] !== ':') return i;
      i++;
    }
    top.n++;
    if (!value()) return i;
  }
  ws();
  return i < text.length ? i : -1;
}

/** Parse JSON; on failure report the line and column where it broke. */
export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const at = jsonErrorOffset(text);
    if (at >= 0) return { ok: false, message, ...lineColumn(text, at) };
    return { ok: false, message };
  }
}

export type DataFormat = 'json' | 'yaml' | 'toml';

/** Make parser output plain JSON data: TOML dates → ISO strings, bigints → strings. */
function toPlain(v: unknown): JsonValue {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)) ?? 'null') as JsonValue;
}

/** Parse YAML. Several documents (`---`) become an array of documents. */
export function parseYaml(text: string): ParseResult {
  const docs = parseAllDocuments(text);
  const list = Array.isArray(docs) ? docs : [docs];
  for (const doc of list) {
    const err = doc.errors[0];
    if (err) {
      const pos = err.linePos?.[0];
      return { ok: false, message: err.message.split('\n')[0], line: pos?.line, column: pos?.col };
    }
  }
  const values = list.map(d => toPlain(d.toJS()));
  return { ok: true, value: values.length === 1 ? values[0] : values.length === 0 ? null : values };
}

/** Parse TOML (always a table at the top). */
export function parseToml(text: string): ParseResult {
  try {
    return { ok: true, value: toPlain(parseTomlText(text)) };
  } catch (e) {
    const err = e as { message?: string; line?: number; column?: number };
    return { ok: false, message: (err.message ?? String(e)).split('\n')[0], line: err.line, column: err.column };
  }
}

/** JSON Lines / NDJSON: one JSON value per non-empty line, read as an array of records. */
export function parseJsonLines(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const records: JsonValue[] = [];
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    if (!line) continue;
    try {
      records.push(JSON.parse(line) as JsonValue);
    } catch (e) {
      const at = jsonErrorOffset(lines[n]);
      return { ok: false, message: `Record on line ${n + 1}: ${e instanceof Error ? e.message : String(e)}`, line: n + 1, column: at >= 0 ? at + 1 : undefined };
    }
  }
  return { ok: true, value: records, variant: 'jsonl', records: records.length };
}

/** JSON5, which also covers JSONC: comments, trailing commas, single quotes, unquoted keys. */
export function parseJson5(text: string): ParseResult {
  try {
    return { ok: true, value: JSON5.parse(text) as JsonValue, variant: 'json5' };
  } catch (e) {
    const err = e as { message?: string; lineNumber?: number; columnNumber?: number };
    return { ok: false, message: err.message ?? String(e), line: err.lineNumber, column: err.columnNumber };
  }
}

/** Several lines that each parse as JSON on their own (and the whole doesn't). */
function looksLikeJsonLines(text: string): boolean {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  try { JSON.parse(lines[0]); JSON.parse(lines[lines.length - 1]); return true; } catch { return false; }
}

/**
 * Any JSON-family text: plain JSON first, then — by extension or by content —
 * JSON Lines/NDJSON or JSON5/JSONC. A strict-JSON error is reported when none fit.
 */
export function parseJsonFamily(text: string, fileName = ''): ParseResult {
  const t = text.replace(/^\uFEFF/, '');
  // The extension is a hint, not a rule: text edited or pasted after loading a
  // file may be another flavour, so fall back to detection before failing.
  const ext = extOf(fileName);
  const hinted = JSONL_EXT.has(ext) ? parseJsonLines(t) : JSON5_EXT.has(ext) ? parseJson5(t) : null;
  if (hinted?.ok) return hinted;
  const strict = parseJson(t);
  if (strict.ok) return strict;
  if (looksLikeJsonLines(t)) {
    const lines = parseJsonLines(t);
    if (lines.ok) return lines;
  }
  const loose = parseJson5(t);
  if (loose.ok) return loose;
  return hinted ?? strict;
}

export function parseData(text: string, format: DataFormat, fileName = ''): ParseResult {
  if (format === 'yaml') return parseYaml(text);
  if (format === 'toml') return parseToml(text);
  return parseJsonFamily(text, fileName);
}

/** Best guess at the format of pasted text or a file (extension wins when known). */
export function detectFormat(text: string, fileName = ''): DataFormat | null {
  const ext = extOf(fileName);
  if (JSON_EXT.has(ext) || JSONL_EXT.has(ext) || JSON5_EXT.has(ext)) return 'json';
  if (ext === 'yaml' || ext === 'yml') return 'yaml';
  if (ext === 'toml') return 'toml';
  const t = text.trim();
  if (!t) return null;
  if (t.startsWith('{') || t.startsWith('[') && !/^\[[\w.\-" ]+\]\s*$/m.test(t)) return 'json';
  if (/^\s*\[{1,2}[\w.\-" ]+\]{1,2}\s*$/m.test(t) || /^\s*[\w.\-"]+\s*=\s*\S/m.test(t)) return 'toml';
  return 'yaml';
}

export const ROOT_PATH = '$';

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Path of a child: `$.name`, `$.items[3]`, or `$["odd key"]` for keys that aren't identifiers. */
export function childPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return `${parent}[${key}]`;
  return IDENT.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

export type NodeKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export function kindOf(v: JsonValue): NodeKind {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v as NodeKind;
}

/** Child entries of a container, as [key, value] pairs (array keys are indices). */
export function entriesOf(v: JsonValue): [string | number, JsonValue][] {
  if (Array.isArray(v)) return v.map((x, i) => [i, x]);
  if (v && typeof v === 'object') return Object.entries(v);
  return [];
}

/** Short one-line rendering of a value, used for primitives and collapsed containers. */
export function preview(v: JsonValue, max = 60): string {
  const kind = kindOf(v);
  if (kind === 'array') return `Array(${(v as JsonValue[]).length})`;
  if (kind === 'object') {
    const keys = Object.keys(v as object);
    const shown = keys.slice(0, 3).join(', ');
    return `{${shown}${keys.length > 3 ? ', …' : ''}}`;
  }
  // JSON5 allows Infinity/NaN, which JSON.stringify would print as null.
  const s = typeof v === 'number' && !Number.isFinite(v) ? String(v) : JSON.stringify(v);
  return s.length > max ? s.slice(0, max - 1) + '…"' : s;
}

export interface JsonStats {
  objects: number;
  arrays: number;
  values: number;
  keys: number;
  maxDepth: number;
}

/** Count containers, primitive values and keys, and the deepest nesting level. Iterative, so deep JSON can't overflow the stack. */
export function statsOf(root: JsonValue): JsonStats {
  const s: JsonStats = { objects: 0, arrays: 0, values: 0, keys: 0, maxDepth: 0 };
  const stack: [JsonValue, number][] = [[root, 0]];
  while (stack.length) {
    const [v, depth] = stack.pop()!;
    s.maxDepth = Math.max(s.maxDepth, depth);
    const kind = kindOf(v);
    if (kind === 'object') {
      s.objects++;
      for (const [, child] of Object.entries(v as object)) { s.keys++; stack.push([child as JsonValue, depth + 1]); }
    } else if (kind === 'array') {
      s.arrays++;
      for (const child of v as JsonValue[]) stack.push([child, depth + 1]);
    } else {
      s.values++;
    }
  }
  return s;
}

export interface SearchResult {
  /** Paths whose key or primitive value contains the query. */
  matches: string[];
  /** Every ancestor of a match — expand these so the matches are visible. */
  expand: Set<string>;
  /** True when the match cap was reached. */
  truncated: boolean;
}

/** Case-insensitive search over keys and primitive values. */
export function searchJson(root: JsonValue, query: string, cap = 500): SearchResult {
  const q = query.trim().toLowerCase();
  const result: SearchResult = { matches: [], expand: new Set(), truncated: false };
  if (!q) return result;
  const stack: [JsonValue, string, string[]][] = [[root, ROOT_PATH, []]];
  while (stack.length) {
    const [v, path, ancestors] = stack.pop()!;
    const kind = kindOf(v);
    if (kind === 'object' || kind === 'array') {
      const entries = entriesOf(v);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [key, child] = entries[i];
        const p = childPath(path, key);
        const chain = [...ancestors, path];
        if (typeof key === 'string' && key.toLowerCase().includes(q)) {
          result.matches.push(p);
          chain.forEach(a => result.expand.add(a));
        }
        stack.push([child, p, chain]);
      }
    } else if (path !== ROOT_PATH || ancestors.length === 0) {
      const text = v === null ? 'null' : String(v);
      if (text.toLowerCase().includes(q) && !result.matches.includes(path)) {
        result.matches.push(path);
        ancestors.forEach(a => result.expand.add(a));
      }
    }
    if (result.matches.length >= cap) { result.truncated = true; break; }
  }
  return result;
}

/** All container paths down to `maxNodes` containers — for "Expand all" without freezing on huge files. */
export function containerPaths(root: JsonValue, maxNodes = 2000): { paths: Set<string>; truncated: boolean } {
  const paths = new Set<string>();
  const queue: [JsonValue, string][] = [[root, ROOT_PATH]];
  while (queue.length) {
    const [v, path] = queue.shift()!;
    const kind = kindOf(v);
    if (kind !== 'object' && kind !== 'array') continue;
    if (paths.size >= maxNodes) return { paths, truncated: true };
    paths.add(path);
    for (const [key, child] of entriesOf(v)) queue.push([child, childPath(path, key)]);
  }
  return { paths, truncated: false };
}

/** Value to copy for a node: primitives as their raw text, containers as pretty JSON. */
export function copyText(v: JsonValue): string {
  if (typeof v === 'string') return v;
  if (v === null || typeof v !== 'object') return String(v);
  return JSON.stringify(v, null, 2);
}
