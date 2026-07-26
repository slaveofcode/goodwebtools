import { describe, it, expect } from 'vitest';
import { jsonToYaml, yamlToJson } from './yaml.lib';
import { jsonToXml, xmlToJson } from './xml.lib';
import { jsonToToml, tomlToJson } from './toml.lib';

const obj = { name: 'Alice', age: 30, tags: ['a', 'b'], active: true };

describe('JSON ↔ YAML', () => {
  it('converts JSON to YAML', () => {
    const yaml = jsonToYaml(JSON.stringify(obj));
    expect(yaml).toContain('name: Alice');
    expect(yaml).toContain('age: 30');
    expect(yaml).toContain('- a');
  });

  it('round-trips JSON -> YAML -> JSON', () => {
    expect(JSON.parse(yamlToJson(jsonToYaml(JSON.stringify(obj))))).toEqual(obj);
  });

  it('surfaces invalid JSON', () => {
    expect(() => jsonToYaml('{not json}')).toThrow();
  });
});

describe('JSON ↔ XML', () => {
  it('wraps a multi-key object in a single <root> element', () => {
    const xml = jsonToXml(JSON.stringify({ a: 1, b: 2 }));
    expect(xml).toContain('<root>');
    expect(xml).toContain('<a>1</a>');
    expect(xml).toContain('<b>2</b>');
  });

  it('uses a single-key object as the root directly', () => {
    const xml = jsonToXml(JSON.stringify({ person: { name: 'Alice' } }));
    expect(xml).toContain('<person>');
    expect(xml).not.toContain('<root>');
  });

  it('parses XML back to JSON', () => {
    expect(JSON.parse(xmlToJson('<person><name>Alice</name><age>30</age></person>'))).toEqual({
      person: { name: 'Alice', age: 30 },
    });
  });

  it('round-trips a single-root object', () => {
    const source = { person: { name: 'Bob', age: 25 } };
    expect(JSON.parse(xmlToJson(jsonToXml(JSON.stringify(source))))).toEqual(source);
  });
});

describe('JSON ↔ TOML', () => {
  it('converts JSON to TOML', () => {
    const toml = jsonToToml(JSON.stringify({ title: 'x', count: 3 }));
    expect(toml).toContain('title = "x"');
    expect(toml).toContain('count = 3');
  });

  it('round-trips JSON -> TOML -> JSON', () => {
    const source = { title: 'demo', count: 3, tags: ['a', 'b'] };
    expect(JSON.parse(tomlToJson(jsonToToml(JSON.stringify(source))))).toEqual(source);
  });

  it('rejects a non-object top level', () => {
    expect(() => jsonToToml('[1,2,3]')).toThrow(/top-level object/i);
    expect(() => jsonToToml('42')).toThrow(/top-level object/i);
  });
});
