import { describe, it, expect } from 'vitest';
import {
  parseJson, jsonErrorOffset, parseJsonFamily, parseJsonLines, parseJson5, parseYaml, parseToml, parseData, detectFormat, lineColumn, childPath, kindOf, entriesOf,
  preview, statsOf, searchJson, containerPaths, copyText, ROOT_PATH, type JsonValue,
} from './json-viewer.lib';

describe('parseJson', () => {
  it('parses valid JSON', () => {
    expect(parseJson('{"a":[1,2]}')).toEqual({ ok: true, value: { a: [1, 2] } });
  });
  it('reports the line and column of a syntax error', () => {
    const r = parseJson('{\n  "a": 1,\n  "b": ,\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(3);
      expect(r.column).toBeGreaterThan(1);
    }
  });
  it('finds the exact error position itself', () => {
    expect(jsonErrorOffset('{"a": 1}')).toBe(-1);
    expect(jsonErrorOffset('[1, 2,]')).toBe(6);
    expect(jsonErrorOffset('{"a" 1}')).toBe(5);
    expect(jsonErrorOffset("{'a': 1}")).toBe(1);
    expect(jsonErrorOffset('{"a": tru}')).toBe(6);
    expect(jsonErrorOffset('[1 2]')).toBe(3);
    expect(jsonErrorOffset('{"a": "x\ny"}')).toBe(8); // the raw newline inside the string
    expect(jsonErrorOffset('[[[]]] x')).toBe(7);
    expect(jsonErrorOffset('{"a": [1, {"b": null}], "c": -1.5e3}')).toBe(-1);
  });
  it('maps an offset to line and column', () => {
    expect(lineColumn('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
  });
});

describe('parseYaml', () => {
  it('parses a document', () => {
    expect(parseYaml('name: gwt\ntags:\n  - a\n  - b\n')).toEqual({ ok: true, value: { name: 'gwt', tags: ['a', 'b'] } });
  });
  it('turns several documents into an array', () => {
    expect(parseYaml('a: 1\n---\nb: 2\n')).toEqual({ ok: true, value: [{ a: 1 }, { b: 2 }] });
  });
  it('reports where a YAML error is', () => {
    const r = parseYaml('a: 1\nb: [1, 2\nc: 3\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBeGreaterThanOrEqual(2);
  });
});

describe('parseToml', () => {
  it('parses tables, arrays of tables and dates into plain data', () => {
    const r = parseToml('title = "x"\n[owner]\nborn = 1979-05-27T07:32:00Z\n[[items]]\nid = 1\n[[items]]\nid = 2\n');
    expect(r).toEqual({ ok: true, value: { title: 'x', owner: { born: '1979-05-27T07:32:00.000Z' }, items: [{ id: 1 }, { id: 2 }] } });
  });
  it('reports where a TOML error is', () => {
    const r = parseToml('a = 1\nb = = 2\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(2);
  });
});

describe('parseData / detectFormat', () => {
  it('dispatches by format', () => {
    expect(parseData('a = 1', 'toml')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseData('a: 1', 'yaml')).toEqual({ ok: true, value: { a: 1 } });
  });
  it('detects from the file extension first', () => {
    expect(detectFormat('a: 1', 'config.yml')).toBe('yaml');
    expect(detectFormat('{}', 'Cargo.toml')).toBe('toml');
  });
  it('detects from content', () => {
    expect(detectFormat('{"a": 1}')).toBe('json');
    expect(detectFormat('[1, 2]')).toBe('json');
    expect(detectFormat('[package]\nname = "x"')).toBe('toml');
    expect(detectFormat('name = "x"')).toBe('toml');
    expect(detectFormat('name: x\nlist:\n  - 1')).toBe('yaml');
    expect(detectFormat('   ')).toBeNull();
  });
});

describe('paths and previews', () => {
  it('builds JSONPath-style child paths', () => {
    expect(childPath(ROOT_PATH, 'items')).toBe('$.items');
    expect(childPath('$.items', 3)).toBe('$.items[3]');
    expect(childPath(ROOT_PATH, 'odd key')).toBe('$["odd key"]');
  });
  it('classifies and lists children', () => {
    expect(kindOf(null)).toBe('null');
    expect(kindOf([1])).toBe('array');
    expect(entriesOf(['x'])).toEqual([[0, 'x']]);
    expect(entriesOf({ a: 1 })).toEqual([['a', 1]]);
  });
  it('previews containers and long strings', () => {
    expect(preview([1, 2, 3])).toBe('Array(3)');
    expect(preview({ a: 1, b: 2, c: 3, d: 4 })).toBe('{a, b, c, …}');
    expect(preview('x'.repeat(100), 10)).toHaveLength(11);
  });
  it('copies primitives raw and containers as pretty JSON', () => {
    expect(copyText('hi')).toBe('hi');
    expect(copyText(42)).toBe('42');
    expect(copyText({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

describe('statsOf', () => {
  it('counts containers, keys, values and depth', () => {
    expect(statsOf({ a: [1, { b: null }], c: 'x' })).toEqual({ objects: 2, arrays: 1, values: 3, keys: 3, maxDepth: 3 });
  });
  it('handles very deep nesting without recursion', () => {
    let deep: JsonValue = 0;
    for (let i = 0; i < 20000; i++) deep = [deep];
    expect(statsOf(deep).maxDepth).toBe(20000);
  });
});

describe('searchJson', () => {
  const doc: JsonValue = { users: [{ name: 'Alice', city: 'Jakarta' }, { name: 'Bob', city: 'Bandung' }], total: 2 };
  it('finds keys and values case-insensitively and lists ancestors to expand', () => {
    const r = searchJson(doc, 'bandung');
    expect(r.matches).toEqual(['$.users[1].city']);
    expect([...r.expand]).toEqual(expect.arrayContaining(['$', '$.users', '$.users[1]']));
  });
  it('matches keys', () => {
    expect(searchJson(doc, 'total').matches).toEqual(['$.total']);
  });
  it('caps the number of matches', () => {
    const r = searchJson(Array.from({ length: 50 }, () => 'x'), 'x', 10);
    expect(r.matches).toHaveLength(10);
    expect(r.truncated).toBe(true);
  });
  it('returns nothing for an empty query', () => {
    expect(searchJson(doc, '  ').matches).toEqual([]);
  });
});

describe('containerPaths', () => {
  it('lists every object/array path', () => {
    expect([...containerPaths({ a: [1, { b: {} }] }).paths]).toEqual(['$', '$.a', '$.a[1]', '$.a[1].b']);
  });
  it('stops at the limit', () => {
    const r = containerPaths(Array.from({ length: 100 }, () => ({})), 10);
    expect(r.paths.size).toBe(10);
    expect(r.truncated).toBe(true);
  });
});

describe('JSON family', () => {
  it('reads JSON Lines / NDJSON by extension, as an array of records', () => {
    const r = parseJsonFamily('{"id":1}\n\n{"id":2}\n', 'events.jsonl');
    expect(r).toEqual({ ok: true, value: [{ id: 1 }, { id: 2 }], variant: 'jsonl', records: 2 });
    expect(parseJsonFamily('{"a":1}', 'one.ndjson')).toMatchObject({ ok: true, value: [{ a: 1 }], records: 1 });
  });
  it('detects JSON Lines from content when there is no extension', () => {
    expect(parseJsonFamily('{"a":1}\n{"a":2}')).toMatchObject({ ok: true, variant: 'jsonl', records: 2 });
    expect(parseJsonFamily('[1,2]\n[3]')).toMatchObject({ ok: true, variant: 'jsonl', value: [[1, 2], [3]] });
  });
  it('points at the bad record in JSON Lines', () => {
    const r = parseJsonLines('{"a":1}\n{"a":2,}\n{"a":3}');
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.line).toBe(2); expect(r.column).toBe(8); expect(r.message).toMatch(/^Record on line 2/); }
  });
  it('reads JSONC / JSON5: comments, trailing commas, unquoted keys, single quotes', () => {
    const jsonc = '{\n  // compiler options\n  "strict": true, /* on */\n  "paths": ["src",],\n}';
    expect(parseJsonFamily(jsonc, 'tsconfig.json')).toEqual({ ok: true, value: { strict: true, paths: ['src'] }, variant: 'json5' });
    expect(parseJsonFamily("{name: 'gwt', hex: 0x10, n: Infinity}", 'cfg.json5')).toMatchObject({ ok: true, value: { name: 'gwt', hex: 16, n: Infinity } });
  });
  it('falls back to detection when text no longer matches the file extension', () => {
    expect(parseJsonFamily('{ // note\n "a": 1, }', 'old.jsonl')).toMatchObject({ ok: true, variant: 'json5', value: { a: 1 } });
    // When nothing fits, the error is the one for the hinted format.
    const r = parseJsonFamily('{"a":1}\n{oops', 'log.jsonl');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/^Record on line 2/);
  });
  it('reports a JSON5 error position', () => {
    const r = parseJson5('{a: 1,\n b: ,}');
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.line).toBe(2); expect(r.column).toBe(5); }
  });
  it('keeps strict JSON as plain JSON and strips a byte-order mark', () => {
    expect(parseJsonFamily('\uFEFF{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });
  it('reports the strict JSON error when no JSON flavour fits', () => {
    const r = parseJsonFamily('{"a": 1,\n"b": }');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(2);
  });
  it('treats JSON-based file types as JSON', () => {
    for (const name of ['a.jsonl', 'a.ndjson', 'a.json5', 'a.jsonc', 'site.webmanifest', 'net.har', 'nb.ipynb', 'app.js.map', 'shapes.topojson']) {
      expect(detectFormat('x: 1', name)).toBe('json');
    }
  });
  it('previews Infinity and NaN as written', () => {
    expect(preview(Infinity)).toBe('Infinity');
    expect(preview(NaN)).toBe('NaN');
  });
});
