import { describe, it, expect } from 'vitest';
import { MIME_TYPES, byExtension, byMime, searchMime } from './mime.lib';

describe('mime', () => {
  it('looks up by extension', () => {
    expect(byExtension('json')[0].mime).toBe('application/json');
  });

  it('ignores a leading dot and case on the extension', () => {
    expect(byExtension('.PNG')[0].mime).toBe('image/png');
  });

  it('returns all extensions that map to a MIME type', () => {
    const exts = byMime('image/jpeg').map((m) => m.ext);
    expect(exts).toContain('jpg');
    expect(exts).toContain('jpeg');
  });

  it('is case-insensitive on the MIME type', () => {
    expect(byMime('APPLICATION/PDF')[0].ext).toBe('pdf');
  });

  it('returns empty for an unknown extension', () => {
    expect(byExtension('nope')).toEqual([]);
  });

  it('searches across ext, mime and name', () => {
    const hits = searchMime('word');
    expect(hits.map((m) => m.ext)).toContain('docx');
  });

  it('returns everything for an empty query', () => {
    expect(searchMime('')).toHaveLength(MIME_TYPES.length);
  });

  it('has a name for every entry', () => {
    expect(MIME_TYPES.every((m) => m.name.length > 0)).toBe(true);
  });
});
