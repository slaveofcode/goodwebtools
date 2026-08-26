import { describe, it, expect } from 'vitest';
import {
  snappyDecompress, decodeIwa, readFields, readArchives, cleanRun,
  slideTextRuns, slideOrder, slideEntryNames, readSlideOutline,
  readRefAt, storageTexts, shapeStorages, slidePlaceholders, slideContent,
} from './iwa.lib';

/* ------------------------------------------------------------- test helpers */

const bytes = (...v: number[]) => new Uint8Array(v);

/** Encode a varint. */
function varint(n: number): number[] {
  const out: number[] = [];
  while (n > 0x7f) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
  out.push(n);
  return out;
}

/** Compress with literals only — a valid snappy block our decoder must accept. */
function snappyLiterals(data: Uint8Array): Uint8Array {
  const out: number[] = [...varint(data.length)];
  let p = 0;
  while (p < data.length) {
    const n = Math.min(60, data.length - p);
    out.push((n - 1) << 2);
    for (let i = 0; i < n; i++) out.push(data[p + i]);
    p += n;
  }
  return new Uint8Array(out);
}

/** Wrap payloads as .iwa chunks (1 reserved byte + 24-bit LE length). */
function iwaFile(...chunks: Uint8Array[]): Uint8Array {
  const out: number[] = [];
  for (const raw of chunks) {
    const block = snappyLiterals(raw);
    out.push(0, block.length & 0xff, (block.length >> 8) & 0xff, (block.length >> 16) & 0xff);
    out.push(...block);
  }
  return new Uint8Array(out);
}

const pbVarint = (no: number, v: number) => [...varint((no << 3) | 0), ...varint(v)];
const pbBytes = (no: number, b: number[]) => [...varint((no << 3) | 2), ...varint(b.length), ...b];
const pbString = (no: number, s: string) => pbBytes(no, [...new TextEncoder().encode(s)]);

/** ArchiveInfo: id + one MessageInfo {type, length}, followed by the payload. */
function archive(id: number, messages: { type: number; payload: number[] }[]): number[] {
  const info = [
    ...pbVarint(1, id),
    ...messages.flatMap(m => pbBytes(2, [...pbVarint(1, m.type), ...pbVarint(3, m.payload.length)])),
  ];
  return [...varint(info.length), ...info, ...messages.flatMap(m => m.payload)];
}

/** A TSWP.StorageArchive (type 2001) carrying text runs in field 3. */
const textArchive = (id: number, ...runs: string[]) =>
  archive(id, [{ type: 2001, payload: runs.flatMap(r => pbString(3, r)) }]);

/** A slide-node archive (type 4) pointing at a slide id, plus a tree listing nodes. */
const nodeArchive = (nodeId: number, slideId: number) =>
  archive(nodeId, [{ type: 4, payload: pbBytes(2, pbVarint(1, slideId)) }]);
const treeArchive = (id: number, nodeIds: number[]) =>
  archive(id, [{ type: 2, payload: nodeIds.flatMap(n => pbBytes(5, pbVarint(1, n))) }]);

/** A plain text box (TSWP.ShapeInfo) owning a storage in field 2. */
const shapeArchive = (id: number, storageId: number) =>
  archive(id, [{ type: 2011, payload: pbBytes(2, pbVarint(1, storageId)) }]);

/** A title/body placeholder, which wraps the shape one level deeper. */
const placeholderArchive = (id: number, storageId: number) =>
  archive(id, [{ type: 7, payload: pbBytes(1, pbBytes(2, pbVarint(1, storageId))) }]);

/** KN.SlideArchive: field 5 = title, field 6 = body, field 7 = drawables. */
const slideArchive = (id: number, title: number | null, body: number | null, drawables: number[]) =>
  archive(id, [{
    type: 5,
    payload: [
      ...(title === null ? [] : pbBytes(5, pbVarint(1, title))),
      ...(body === null ? [] : pbBytes(6, pbVarint(1, body))),
      ...drawables.flatMap(d => pbBytes(7, pbVarint(1, d))),
    ],
  }]);

/* -------------------------------------------------------------------- tests */

describe('snappyDecompress', () => {
  it('round-trips a literal-only block', () => {
    const data = new TextEncoder().encode('Keynote slide text');
    expect(Array.from(snappyDecompress(snappyLiterals(data)))).toEqual(Array.from(data));
  });

  it('handles a literal run longer than 60 bytes', () => {
    const data = new TextEncoder().encode('x'.repeat(200));
    expect(Array.from(snappyDecompress(snappyLiterals(data)))).toEqual(Array.from(data));
  });

  it('expands a back-reference', () => {
    // "abcabcabc": literal "abc", then copy 6 bytes from offset 3 (overlapping).
    const block = bytes(9, (3 - 1) << 2, 0x61, 0x62, 0x63, ((6 - 1) << 2) | 2, 3, 0);
    expect(new TextDecoder().decode(snappyDecompress(block))).toBe('abcabcabc');
  });

  it('returns empty for truncated input instead of throwing', () => {
    expect(snappyDecompress(bytes()).length).toBe(0);
    expect(snappyDecompress(bytes(0xff)).length).toBe(0);
  });

  it('stops cleanly when a literal claims more bytes than remain', () => {
    expect(snappyDecompress(bytes(100, (99 - 1) << 2, 0x61)).length).toBe(0);
  });

  it('refuses a back-reference pointing before the start of the output', () => {
    expect(snappyDecompress(bytes(4, ((4 - 1) << 2) | 2, 9, 0)).length).toBe(0);
  });
});

describe('decodeIwa', () => {
  it('concatenates the payload of every chunk', () => {
    const a = new TextEncoder().encode('first-');
    const b = new TextEncoder().encode('second');
    expect(new TextDecoder().decode(decodeIwa(iwaFile(a, b)))).toBe('first-second');
  });

  it('ignores a trailing chunk whose length runs past the end', () => {
    const good = iwaFile(new TextEncoder().encode('ok'));
    const truncated = new Uint8Array([...good, 0, 0xff, 0xff, 0x00]);
    expect(new TextDecoder().decode(decodeIwa(truncated))).toBe('ok');
  });

  it('returns empty for an empty file', () => {
    expect(decodeIwa(bytes()).length).toBe(0);
  });
});

describe('readFields', () => {
  it('reads varint, length-delimited and fixed fields', () => {
    const buf = new Uint8Array([
      ...pbVarint(1, 2652150),
      ...pbString(3, 'Title'),
      ...varint((7 << 3) | 5), 1, 0, 0, 0,
    ]);
    const got = [...readFields(buf)];
    expect(got[0]).toMatchObject({ no: 1, wire: 0, value: 2652150 });
    expect(new TextDecoder().decode(got[1].bytes!)).toBe('Title');
    expect(got[2]).toMatchObject({ no: 7, wire: 5, value: 1 });
  });

  it('stops at a length that overruns the buffer', () => {
    expect([...readFields(new Uint8Array([...varint((1 << 3) | 2), 50, 1, 2]))]).toEqual([]);
  });

  it('stops on a zero field number rather than looping', () => {
    expect([...readFields(bytes(0x00, 0x01))]).toEqual([]);
  });
});

describe('readArchives', () => {
  it('splits archives and keeps message types and payloads', () => {
    const decoded = new Uint8Array([...textArchive(11, 'Hello'), ...textArchive(22, 'World')]);
    const got = readArchives(decoded);
    expect(got.map(a => a.id)).toEqual([11, 22]);
    expect(got[0].messages[0].type).toBe(2001);
    expect(slideTextRuns(got)).toEqual(['Hello', 'World']);
  });

  it('returns what it parsed when the stream is truncated mid-payload', () => {
    const full = new Uint8Array([...textArchive(11, 'Hello'), ...textArchive(22, 'World')]);
    const cut = full.subarray(0, full.length - 4);
    expect(readArchives(cut).map(a => a.id)).toEqual([11]);
  });
});

describe('cleanRun', () => {
  it('drops the object-replacement placeholder and collapses whitespace', () => {
    expect(cleanRun('Hello\n\n  world ')).toBe('Hello world');
    expect(cleanRun('￼')).toBe('');
    expect(cleanRun('Title￼')).toBe('Title');
  });
});

describe('readRefAt', () => {
  it('reads a reference at a nested field path', () => {
    const buf = new Uint8Array(pbBytes(1, pbBytes(2, pbVarint(1, 4030986))));
    expect(readRefAt(buf, [1, 2])).toBe(4030986);
  });

  it('returns null when the path does not exist', () => {
    const buf = new Uint8Array(pbBytes(1, pbVarint(1, 7)));
    expect(readRefAt(buf, [9, 2])).toBeNull();
  });
});

describe('slide structure', () => {
  // Storages deliberately appear in the WRONG visual order: the subtitle text
  // is stored before the title, which is exactly what tripped up plain
  // document-order extraction on a real Keynote file.
  const build = () => readArchives(new Uint8Array([
    ...textArchive(100, 'A subtitle under the title'),
    ...shapeArchive(101, 100),
    ...textArchive(110, 'The Real Title'),
    ...placeholderArchive(111, 110),
    ...textArchive(120, 'A bullet point'),
    ...placeholderArchive(121, 120),
    ...slideArchive(200, 111, 121, [101, 111, 121]),
  ]));

  it('maps both plain text boxes and placeholders to their storage', () => {
    const ars = build();
    const ids = new Set(storageTexts(ars).keys());
    expect([...shapeStorages(ars, ids)]).toEqual([[101, 100], [111, 110], [121, 120]]);
  });

  it('reads the title, body and drawable references off the slide archive', () => {
    expect(slidePlaceholders(build())).toEqual({ title: 111, body: 121, drawables: [101, 111, 121] });
  });

  it('uses the title placeholder as the heading, not the first stored run', () => {
    expect(slideContent(build())).toEqual({
      title: 'The Real Title',
      body: ['A bullet point', 'A subtitle under the title'],
    });
  });

  it('falls back to document order when the slide has no placeholders', () => {
    const ars = readArchives(new Uint8Array(textArchive(1, 'Only run', 'Second run')));
    expect(slideContent(ars)).toEqual({ title: 'Only run', body: ['Second run'] });
  });

  it('promotes a text box when the title placeholder is empty', () => {
    const ars = readArchives(new Uint8Array([
      ...textArchive(100, 'Text box content'),
      ...shapeArchive(101, 100),
      ...slideArchive(200, null, null, [101]),
    ]));
    expect(slideContent(ars)).toEqual({ title: 'Text box content', body: [] });
  });

  it('returns empty content for a slide with no text at all', () => {
    const ars = readArchives(new Uint8Array(slideArchive(200, null, null, [])));
    expect(slideContent(ars)).toEqual({ title: '', body: [] });
  });
});

describe('slideEntryNames', () => {
  it('selects slide archives and excludes the theme template slides', () => {
    const names = [
      'Index/Slide.iwa', 'Index/Slide-2652578-2.iwa', 'Index/TemplateSlide-2651716.iwa',
      'Index/Document.iwa', 'preview.jpg',
    ];
    expect(slideEntryNames(names)).toEqual(['Index/Slide.iwa', 'Index/Slide-2652578-2.iwa']);
  });
});

describe('slideOrder', () => {
  const doc = readArchives(new Uint8Array([
    ...nodeArchive(101, 5001),
    ...nodeArchive(102, 5002),
    ...nodeArchive(103, 5003),
    ...treeArchive(900, [103, 101, 102]),
  ]));

  it('follows the slide tree, not the object ids', () => {
    expect(slideOrder(doc, new Set([5001, 5002, 5003]))).toEqual([5003, 5001, 5002]);
  });

  it('ignores a tree whose slides are not in the document (theme masters)', () => {
    const withMasters = readArchives(new Uint8Array([
      ...nodeArchive(101, 5001),
      ...nodeArchive(102, 5002),
      ...nodeArchive(201, 9001),
      ...nodeArchive(202, 9002),
      ...nodeArchive(203, 9003),
      ...treeArchive(900, [102, 101]),
      ...treeArchive(901, [201, 202, 203]), // longer, but all master slides
    ]));
    expect(slideOrder(withMasters, new Set([5001, 5002]))).toEqual([5002, 5001]);
  });

  it('returns nothing when there are no slide nodes', () => {
    expect(slideOrder(readArchives(new Uint8Array(textArchive(1, 'x'))), new Set([1]))).toEqual([]);
  });
});

describe('readSlideOutline', () => {
  const entries = (): Record<string, Uint8Array> => ({
    'preview.jpg': bytes(1, 2, 3),
    'Index/Slide.iwa': iwaFile(new Uint8Array(textArchive(5002, 'Second Slide', 'Body of two'))),
    'Index/Slide-77.iwa': iwaFile(new Uint8Array(textArchive(5001, 'First Slide', 'Body of one'))),
    'Index/TemplateSlide-9.iwa': iwaFile(new Uint8Array(textArchive(9001, 'Theme Master'))),
    'Index/Document.iwa': iwaFile(new Uint8Array([
      ...nodeArchive(101, 5001),
      ...nodeArchive(102, 5002),
      ...treeArchive(900, [101, 102]),
    ])),
  });

  it('returns every slide in presentation order with title and body split', () => {
    const got = readSlideOutline(entries());
    expect(got.map(s => s.title)).toEqual(['First Slide', 'Second Slide']);
    expect(got[0].body).toEqual(['Body of one']);
    expect(got[1].id).toBe(5002);
  });

  it('never includes the theme template slides', () => {
    expect(readSlideOutline(entries()).map(s => s.title)).not.toContain('Theme Master');
  });

  it('honours a reordered slide tree', () => {
    const e = entries();
    e['Index/Document.iwa'] = iwaFile(new Uint8Array([
      ...nodeArchive(101, 5001),
      ...nodeArchive(102, 5002),
      ...treeArchive(900, [102, 101]),
    ]));
    expect(readSlideOutline(e).map(s => s.title)).toEqual(['Second Slide', 'First Slide']);
  });

  it('falls back to object-id order when the document tree is missing', () => {
    const e = entries();
    delete e['Index/Document.iwa'];
    expect(readSlideOutline(e).map(s => s.title)).toEqual(['First Slide', 'Second Slide']);
  });

  it('appends slides the tree forgot to mention', () => {
    const e = entries();
    e['Index/Document.iwa'] = iwaFile(new Uint8Array([
      ...nodeArchive(102, 5002),
      ...treeArchive(900, [102]),
    ]));
    expect(readSlideOutline(e).map(s => s.title)).toEqual(['Second Slide', 'First Slide']);
  });

  it('returns an empty outline for a document with no slide archives', () => {
    expect(readSlideOutline({ 'preview.jpg': bytes(1) })).toEqual([]);
  });

  it('survives a corrupt slide archive', () => {
    const e = entries();
    e['Index/Slide.iwa'] = bytes(0, 200, 0, 0, 9, 9, 9);
    expect(readSlideOutline(e).map(s => s.title)).toEqual(['First Slide']);
  });

  it('keeps a slide that has no text at all', () => {
    const e = entries();
    e['Index/Slide.iwa'] = iwaFile(new Uint8Array(textArchive(5002)));
    const got = readSlideOutline(e);
    expect(got).toHaveLength(2);
    expect(got[1]).toMatchObject({ id: 5002, title: '', body: [] });
  });
});
