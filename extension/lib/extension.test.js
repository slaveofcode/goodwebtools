import { describe, it, expect, vi } from 'vitest';
import { MENU_ITEMS, toolUrl, pickLang, findMenuItem } from './menus.js';
import { createHandoffStore, isFresh, bytesToBase64, TTL_MS } from './handoff-store.js';
import { searchTools, pushRecent, toggleFavorite } from './search.js';

describe('menus', () => {
  it('has unique ids and a tool + payload for each item', () => {
    expect(new Set(MENU_ITEMS.map(m => m.id)).size).toBe(MENU_ITEMS.length);
    for (const m of MENU_ITEMS) {
      expect(m.tool).toMatch(/^[a-z0-9-]+$/);
      expect(['image', 'selection', 'link', 'page']).toContain(m.payload);
    }
    expect(findMenuItem('img-compress').tool).toBe('image-compress');
    expect(findMenuItem('nope')).toBeNull();
  });
  it('builds tool URLs with locale and handoff id', () => {
    expect(toolUrl('https://goodwebtools.com', 'json-viewer', 'en', 'abc-12345')).toBe('https://goodwebtools.com/tools/json-viewer/#gwt-handoff=abc-12345');
    expect(toolUrl('http://localhost:4321/', 'qr-gen', 'id')).toBe('http://localhost:4321/id/tools/qr-gen/');
    expect(toolUrl(undefined, 'base64', 'en')).toBe('https://goodwebtools.com/tools/base64/');
  });
  it('picks the site language', () => {
    expect(pickLang('en', 'id')).toBe('en');
    expect(pickLang(undefined, 'id-ID')).toBe('id');
    expect(pickLang(undefined, 'en-US')).toBe('en');
  });
});

describe('handoff store', () => {
  const fakeSession = () => {
    const data = {};
    return {
      data,
      set: vi.fn(async o => Object.assign(data, o)),
      get: vi.fn(async k => (k in data ? { [k]: data[k] } : {})),
      remove: vi.fn(async k => { delete data[k]; }),
    };
  };
  it('hands a payload over once', async () => {
    const store = createHandoffStore(fakeSession());
    const id = await store.put({ kind: 'text', text: 'hi' });
    expect(id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(await store.take(id)).toEqual({ kind: 'text', text: 'hi' });
    expect(await store.take(id)).toBeNull();
  });
  it('survives a service-worker restart via session storage', async () => {
    const session = fakeSession();
    const id = await createHandoffStore(session).put({ kind: 'text', text: 'x' });
    expect(await createHandoffStore(session).take(id)).toEqual({ kind: 'text', text: 'x' });
  });
  it('expires after the TTL', async () => {
    const store = createHandoffStore(fakeSession());
    const id = await store.put({ kind: 'text', text: 'x' }, 0);
    expect(await store.take(id, TTL_MS + 1)).toBeNull();
    expect(isFresh({ at: 0 }, TTL_MS - 1)).toBe(true);
  });
  it('keeps big payloads in memory when session storage refuses them', async () => {
    const session = fakeSession();
    session.set = vi.fn(async () => { throw new Error('QUOTA_BYTES quota exceeded'); });
    const store = createHandoffStore(session);
    const id = await store.put({ kind: 'file', base64: 'x'.repeat(10) });
    expect(await store.take(id)).toEqual({ kind: 'file', base64: 'x'.repeat(10) });
  });
  it('encodes large byte arrays to base64', () => {
    const bytes = new Uint8Array(100000).map((_, i) => i % 256);
    expect(atob(bytesToBase64(bytes)).length).toBe(100000);
    expect(bytesToBase64(new TextEncoder().encode('hello'))).toBe(btoa('hello'));
  });
});

describe('search', () => {
  const tools = [
    { id: 'json-format', name: 'JSON Formatter', nameId: 'JSON Formatter', summary: 'Format JSON', keywords: ['json', 'beautify'] },
    { id: 'json-viewer', name: 'JSON Viewer', nameId: 'Penampil JSON', summary: 'Tree', keywords: ['json tree'] },
    { id: 'image-compress', name: 'Image Compressor', nameId: 'Kompres Gambar', summary: 'Shrink images', keywords: ['compress', 'kecilkan'] },
    { id: 'pdf-compress', name: 'Compress PDF', nameId: 'Kompres PDF', summary: 'Smaller PDFs', keywords: ['compress'] },
  ];
  it('ranks name matches first and needs every word to match', () => {
    expect(searchTools(tools, 'json view').map(t => t.id)).toEqual(['json-viewer']);
    expect(searchTools(tools, 'compress').map(t => t.id)).toEqual(['pdf-compress', 'image-compress']);
    expect(searchTools(tools, 'compress image').map(t => t.id)).toEqual(['image-compress']);
  });
  it('matches Indonesian names and keywords', () => {
    expect(searchTools(tools, 'penampil')[0].id).toBe('json-viewer');
    expect(searchTools(tools, 'kompres gambar')[0].id).toBe('image-compress');
  });
  it('returns nothing for an empty query', () => {
    expect(searchTools(tools, '   ')).toEqual([]);
  });
  it('keeps recents deduped and capped, and toggles favorites', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
    expect(toggleFavorite(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b']);
  });
});
