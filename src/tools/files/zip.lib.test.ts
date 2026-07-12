import { describe, it, expect } from 'vitest';
import { createZip, extractZip } from './zip.lib';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (u: Uint8Array) => new TextDecoder().decode(u);

describe('zip create/extract', () => {
  it('round-trips files through a zip archive', () => {
    const zip = createZip([
      { name: 'a.txt', data: enc('hello') },
      { name: 'dir/b.txt', data: enc('world') },
    ]);
    const out = extractZip(zip);
    const byName = Object.fromEntries(out.map(e => [e.name, dec(e.data)]));
    expect(byName).toEqual({ 'a.txt': 'hello', 'dir/b.txt': 'world' });
  });

  it('produces a well-formed zip (PK signature)', () => {
    const zip = createZip([{ name: 'x', data: enc('y') }]);
    expect(zip[0]).toBe(0x50); // 'P'
    expect(zip[1]).toBe(0x4b); // 'K'
  });

  it('throws when zipping nothing', () => {
    expect(() => createZip([])).toThrow(/at least one file/i);
  });

  it('rejects a non-zip input', () => {
    expect(() => extractZip(enc('not a zip at all'))).toThrow(/not a valid \.zip/i);
  });

  it('omits directory entries on extract', () => {
    // Build a zip that includes an explicit directory entry.
    const zip = createZip([
      { name: 'folder/', data: new Uint8Array() },
      { name: 'folder/file.txt', data: enc('hi') },
    ]);
    const names = extractZip(zip).map(e => e.name);
    expect(names).toEqual(['folder/file.txt']);
  });
});
