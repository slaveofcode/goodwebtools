import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractDocText } from './doc.lib';

// Real Word 97-2003 binary .doc files (generated with macOS `textutil`, neutral
// synthetic content) — regression coverage for the OLE + piece-table extractor.
const load = (name: string) =>
  new Uint8Array(readFileSync(resolve(process.cwd(), 'src/tools/documents/__fixtures__', name)));

describe('extractDocText on real .doc fixtures', () => {
  it('extracts plain and Unicode text from a simple .doc', () => {
    const text = extractDocText(load('sample.doc'));
    expect(text).toContain('Hello World');
    expect(text).toContain('This is a test document.');
    expect(text).toContain('Café résumé'); // accented characters
    expect(text).toContain('90% done');
    expect(text).toContain('Line A');
    expect(text).toContain('Line B');
  });

  it('extracts a table as rows (tab-separated cells) plus a bulleted list', () => {
    const text = extractDocText(load('table.doc'));
    expect(text).toContain('Quarterly Report');
    expect(text).toContain('Item\tQ1\tQ2');
    expect(text).toContain('Revenue\t100\t150');
    expect(text).toContain('Costs\t40\t55');
    expect(text).toContain('First bullet');
    expect(text).toContain('Closing line.');
  });
});
