import { describe, it, expect } from 'vitest';
import { parseCsv, csvToJson, jsonToCsv } from './csv.lib';

describe('csvToJson', () => {
  it('converts a simple CSV to JSON', () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    expect(JSON.parse(csvToJson(csv))).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'name,note\nAlice,"hello, world"';
    expect(JSON.parse(csvToJson(csv))).toEqual([{ name: 'Alice', note: 'hello, world' }]);
  });

  it('handles escaped double-quotes ("")', () => {
    const csv = 'name,quote\nAlice,"she said ""hi"""';
    expect(JSON.parse(csvToJson(csv))).toEqual([{ name: 'Alice', quote: 'she said "hi"' }]);
  });

  it('handles CRLF line endings', () => {
    const csv = 'name,age\r\nAlice,30\r\nBob,25';
    expect(JSON.parse(csvToJson(csv))).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('returns [] for empty input', () => {
    expect(csvToJson('')).toBe('[]');
  });
});

describe('parseCsv', () => {
  it('parses quoted fields with embedded newlines', () => {
    const csv = 'name,note\n"Alice","line1\nline2"';
    expect(parseCsv(csv)).toEqual([
      ['name', 'note'],
      ['Alice', 'line1\nline2'],
    ]);
  });
});

describe('jsonToCsv', () => {
  it('builds headers from the union of keys', () => {
    const json = JSON.stringify([{ a: 1, b: 2 }, { b: 3, c: 4 }]);
    expect(jsonToCsv(json)).toBe('a,b,c\n1,2,\n,3,4');
  });

  it('quotes fields containing commas, quotes, or newlines', () => {
    const json = JSON.stringify([
      { plain: 'x', comma: 'a,b', quote: 'she said "hi"', newline: 'l1\nl2' },
    ]);
    expect(jsonToCsv(json)).toBe(
      'plain,comma,quote,newline\nx,"a,b","she said ""hi""","l1\nl2"'
    );
  });

  it('converts a single JSON object to one CSV row', () => {
    expect(jsonToCsv('{"name":"Alice","age":30}')).toBe('name,age\nAlice,30');
  });

  it('throws when JSON is a scalar or array of scalars', () => {
    expect(() => jsonToCsv('42')).toThrow(/object or an array of objects/);
    expect(() => jsonToCsv('"hi"')).toThrow(/object or an array of objects/);
  });

  it('returns an empty string for an empty array', () => {
    expect(jsonToCsv('[]')).toBe('');
  });

  it('round-trips CSV -> JSON -> CSV', () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    expect(jsonToCsv(csvToJson(csv))).toBe(csv);
  });
});

describe('custom delimiters', () => {
  it('parses semicolon-delimited CSV', () => {
    expect(JSON.parse(csvToJson('name;age\nAlice;30', ';'))).toEqual([{ name: 'Alice', age: '30' }]);
  });

  it('parses pipe-delimited CSV', () => {
    expect(JSON.parse(csvToJson('a|b\n1|2', '|'))).toEqual([{ a: '1', b: '2' }]);
  });

  it('parses tab-delimited CSV', () => {
    expect(JSON.parse(csvToJson('a\tb\n1\t2', '\t'))).toEqual([{ a: '1', b: '2' }]);
  });

  it('writes JSON to a semicolon-delimited CSV', () => {
    expect(jsonToCsv('[{"a":"1","b":"2"}]', ';')).toBe('a;b\n1;2');
  });

  it('quotes fields that contain the chosen delimiter', () => {
    // The value "x;y" contains the semicolon delimiter, so it must be quoted.
    expect(jsonToCsv('[{"v":"x;y"}]', ';')).toBe('v\n"x;y"');
    // …but with a comma delimiter the same value needs no quoting.
    expect(jsonToCsv('[{"v":"x;y"}]', ',')).toBe('v\nx;y');
  });

  it('round-trips through a non-comma delimiter', () => {
    const csv = 'name;city\nAlice;Paris\nBob;Rome';
    expect(jsonToCsv(csvToJson(csv, ';'), ';')).toBe(csv);
  });
});
