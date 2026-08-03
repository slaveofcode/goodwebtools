import { describe, it, expect } from 'vitest';
import { groupLines, paragraphsFromLines, reconstruct, textDensity, type TextItem } from './pdf-docx.lib';

const item = (text: string, x: number, y: number, width: number, height = 10): TextItem => ({ text, x, y, width, height });

describe('groupLines', () => {
  it('clusters items on the same baseline into one line, ordered by x', () => {
    const lines = groupLines([item('world', 60, 100, 40), item('Hello', 10, 100, 40), item('Bottom', 10, 130, 50)]);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('Hello world'); // gap → space, x-ordered
    expect(lines[1].text).toBe('Bottom');
  });

  it('does not add a space when items already abut', () => {
    // 'foo' ends at x=30, 'bar' starts at x=31 → no visible gap
    const [line] = groupLines([item('foo', 10, 50, 20), item('bar', 31, 50, 20)]);
    expect(line.text).toBe('foobar');
  });

  it('tolerates small baseline jitter within one line', () => {
    const lines = groupLines([item('a', 10, 100, 8), item('b', 22, 102, 8)]);
    expect(lines).toHaveLength(1);
  });

  it('returns nothing for empty/blank items', () => {
    expect(groupLines([])).toEqual([]);
    expect(groupLines([item('   ', 0, 0, 10)])).toEqual([]);
  });
});

describe('paragraphsFromLines', () => {
  it('merges tightly-spaced lines into one paragraph and splits on a big gap', () => {
    const paras = paragraphsFromLines([
      { text: 'line one', x: 0, y: 100, height: 10 },
      { text: 'line two', x: 0, y: 112, height: 10 }, // gap 12 ≈ line height → same para
      { text: 'far away', x: 0, y: 200, height: 10 }, // big gap → new para
    ]);
    expect(paras).toHaveLength(2);
    expect(paras[0].text).toBe('line one line two');
    expect(paras[1].text).toBe('far away');
  });

  it('promotes a much larger line to a standalone heading', () => {
    const paras = paragraphsFromLines([
      { text: 'TITLE', x: 0, y: 40, height: 24 },     // ~2.4× body → heading 1
      { text: 'body text here', x: 0, y: 70, height: 10 },
      { text: 'more body', x: 0, y: 82, height: 10 },
    ]);
    expect(paras[0]).toEqual({ text: 'TITLE', heading: 1 });
    expect(paras[1]).toEqual({ text: 'body text here more body', heading: 0 });
  });
});

describe('reconstruct + textDensity', () => {
  it('turns a positioned page into paragraphs end to end', () => {
    const items = [
      item('Report', 10, 20, 60, 20),
      item('This', 10, 60, 25), item('is', 40, 60, 12), item('body.', 55, 60, 30),
      item('More', 10, 72, 30),
      item('text', 10, 84, 30),
    ];
    const paras = reconstruct(items);
    expect(paras[0]).toEqual({ text: 'Report', heading: 1 }); // 2× body height → heading
    expect(paras[1].text).toBe('This is body. More text');
  });

  it('textDensity counts non-whitespace characters (for the OCR-fallback decision)', () => {
    expect(textDensity([item('a b', 0, 0, 10), item('  ', 0, 0, 10)])).toBe(2);
    expect(textDensity([])).toBe(0);
  });
});
