import { describe, it, expect } from 'vitest';
import { tools, getToolById, getToolByRoute, searchTools } from './tools';

describe('Tool Registry', () => {
  it('exports a non-empty tools array', () => {
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('every tool has a valid ToolDef shape', () => {
    for (const tool of tools) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.route).toBe(`/tools/${tool.id}`);
      expect(Array.isArray(tool.keywords)).toBe(true);
      expect(typeof tool.load).toBe('function');
      expect(['stable', 'beta', 'experimental']).toContain(tool.status);
    }
  });

  it('has unique tool ids', () => {
    const ids = tools.map(tool => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('looks tools up by id and route', () => {
    const first = tools[0];
    expect(getToolById(first.id)).toBe(first);
    expect(getToolByRoute(first.route)).toBe(first);
    expect(getToolById('does-not-exist')).toBeUndefined();
  });

  it('returns all tools for an empty query', () => {
    expect(searchTools('')).toHaveLength(tools.length);
    expect(searchTools('   ')).toHaveLength(tools.length);
  });

  it('matches on name, keywords, and summary', () => {
    // Name / keyword match
    expect(searchTools('json').some(t => t.id === 'json-format')).toBe(true);
    // Summary match ("SHA-256" appears in the hash tool summary)
    expect(searchTools('256').some(t => t.id === 'hash')).toBe(true);
  });

  it('returns nothing for a nonsense query', () => {
    expect(searchTools('zzzznotarealtool')).toHaveLength(0);
  });

  it('matches inflected / stemmed queries', () => {
    // The original bug: "signed" did not surface the Sign PDF tool.
    expect(searchTools('signed').some(t => t.id === 'pdf-sign')).toBe(true);
    expect(searchTools('sign').some(t => t.id === 'pdf-sign')).toBe(true);
    // plural / gerund forms should still match
    expect(searchTools('images').some(t => t.category === 'Image')).toBe(true);
    expect(searchTools('converting').some(t => t.id === 'image-convert')).toBe(true);
  });

  it('handles multi-word queries and abbreviations', () => {
    const signPdf = searchTools('sign pdf');
    expect(signPdf.some(t => t.id === 'pdf-sign')).toBe(true);
    // abbreviation keyword match
    expect(searchTools('css').some(t => t.id === 'minifier')).toBe(true);
  });

  it('ranks the most relevant tool first', () => {
    expect(searchTools('sign pdf')[0].id).toBe('pdf-sign');
    expect(searchTools('word counter')[0].id).toBe('word-counter');
  });
});
