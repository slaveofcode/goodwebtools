import { describe, it, expect } from 'vitest';
import { tools } from './tools';
import { buildToolsIndex } from './tools-index';

describe('buildToolsIndex', () => {
  const index = buildToolsIndex(tools);

  it('lists every tool once with a route', () => {
    expect(index).toHaveLength(tools.length);
    expect(new Set(index.map(t => t.id)).size).toBe(tools.length);
    for (const t of index) expect(t.route).toMatch(/^\/tools\/[a-z0-9-]+$/);
  });

  it('carries English and Indonesian labels', () => {
    const viewer = index.find(t => t.id === 'json-viewer')!;
    expect(viewer.name).toBe('JSON Viewer');
    expect(viewer.nameId).toBe('Penampil JSON');
    expect(viewer.keywords).toContain('jsonl viewer');
  });

  it('is plain JSON (no functions or components)', () => {
    expect(JSON.parse(JSON.stringify(index))).toEqual(index);
  });
});
