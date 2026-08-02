import { describe, it, expect } from 'vitest';
import { flattenToc } from './epub-toc.lib';

describe('flattenToc', () => {
  it('flattens nested chapters with increasing depth', () => {
    const toc = [
      { href: 'ch1.html', label: 'Chapter 1', subitems: [
        { href: 'ch1.html#s1', label: 'Section 1.1' },
        { href: 'ch1.html#s2', label: 'Section 1.2' },
      ] },
      { href: 'ch2.html', label: 'Chapter 2' },
    ];
    expect(flattenToc(toc)).toEqual([
      { href: 'ch1.html', label: 'Chapter 1', depth: 0 },
      { href: 'ch1.html#s1', label: 'Section 1.1', depth: 1 },
      { href: 'ch1.html#s2', label: 'Section 1.2', depth: 1 },
      { href: 'ch2.html', label: 'Chapter 2', depth: 0 },
    ]);
  });

  it('trims whitespace/newlines in labels (common in EPUB nav)', () => {
    const flat = flattenToc([{ href: 'a.html', label: '\n   Prologue  \n' }]);
    expect(flat[0].label).toBe('Prologue');
  });

  it('falls back to the href when a label is empty', () => {
    const flat = flattenToc([{ href: 'cover.xhtml', label: '   ' }]);
    expect(flat[0].label).toBe('cover.xhtml');
  });

  it('skips entries with no href', () => {
    const flat = flattenToc([
      { href: '', label: 'Unlinked heading', subitems: [{ href: 'x.html', label: 'Real' }] },
    ]);
    expect(flat).toEqual([{ href: 'x.html', label: 'Real', depth: 1 }]);
  });

  it('handles empty / missing input', () => {
    expect(flattenToc([])).toEqual([]);
    // @ts-expect-error — defensive: real EPUBs sometimes have no nav
    expect(flattenToc(undefined)).toEqual([]);
  });
});
