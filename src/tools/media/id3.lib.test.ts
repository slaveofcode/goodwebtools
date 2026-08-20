import { describe, it, expect } from 'vitest';
import { parseId3 } from './id3.lib';

/** Build a synthetic ID3v2 tag for testing. */
function makeTag(frames: { id: string; payload: number[] }[], major = 3): Uint8Array {
  const body: number[] = [];
  for (const f of frames) {
    const size = f.payload.length;
    body.push(...[...f.id].map((c) => c.charCodeAt(0)));
    if (major === 4) {
      body.push((size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f);
    } else {
      body.push((size >>> 24) & 0xff, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff);
    }
    body.push(0, 0); // frame flags
    body.push(...f.payload);
  }
  const total = body.length;
  const header = [
    0x49, 0x44, 0x33, major, 0, 0,
    (total >> 21) & 0x7f, (total >> 14) & 0x7f, (total >> 7) & 0x7f, total & 0x7f,
  ];
  return Uint8Array.from([...header, ...body]);
}

const latin = (s: string): number[] => [0, ...[...s].map((c) => c.charCodeAt(0))];
const utf8 = (s: string): number[] => [3, ...Array.from(new TextEncoder().encode(s))];

describe('parseId3', () => {
  it('returns empty tags when there is no ID3 header', () => {
    expect(parseId3(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toEqual({});
    expect(parseId3(new Uint8Array(3))).toEqual({});
  });

  it('reads title, artist and album (v2.3, latin-1)', () => {
    const tag = makeTag([
      { id: 'TIT2', payload: latin('Song Title') },
      { id: 'TPE1', payload: latin('The Artist') },
      { id: 'TALB', payload: latin('An Album') },
    ]);
    expect(parseId3(tag)).toMatchObject({ title: 'Song Title', artist: 'The Artist', album: 'An Album' });
  });

  it('reads UTF-8 text frames (v2.4 synchsafe sizes)', () => {
    const tag = makeTag([{ id: 'TIT2', payload: utf8('Café — Lagu') }], 4);
    expect(parseId3(tag).title).toBe('Café — Lagu');
  });

  it('trims trailing NUL padding', () => {
    const tag = makeTag([{ id: 'TIT2', payload: [...latin('Padded'), 0, 0] }]);
    expect(parseId3(tag).title).toBe('Padded');
  });

  it('reads the year from either TYER or TDRC', () => {
    expect(parseId3(makeTag([{ id: 'TYER', payload: latin('1999') }])).year).toBe('1999');
    expect(parseId3(makeTag([{ id: 'TDRC', payload: latin('2026') }], 4)).year).toBe('2026');
  });

  it('extracts embedded cover art', () => {
    const mime = [...'image/png'].map((c) => c.charCodeAt(0));
    const imageBytes = [0x89, 0x50, 0x4e, 0x47, 1, 2, 3];
    const payload = [0, ...mime, 0, 3, ...latin('cover').slice(1), 0, ...imageBytes];
    const tags = parseId3(makeTag([{ id: 'APIC', payload }]));
    expect(tags.picture?.mime).toBe('image/png');
    expect(Array.from(tags.picture!.data)).toEqual(imageBytes);
  });

  it('ignores unknown frames and stops at padding', () => {
    const tag = makeTag([
      { id: 'TIT2', payload: latin('Real') },
      { id: 'XXXX', payload: latin('junk') },
    ]);
    const padded = Uint8Array.from([...tag, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(parseId3(padded).title).toBe('Real');
  });

  it('never throws on truncated or malformed data', () => {
    const tag = makeTag([{ id: 'TIT2', payload: latin('Whole') }]);
    for (let cut = 10; cut < tag.length; cut++) {
      expect(() => parseId3(tag.subarray(0, cut))).not.toThrow();
    }
  });

  it('ignores unsupported major versions', () => {
    const tag = makeTag([{ id: 'TIT2', payload: latin('v2') }]);
    tag[3] = 2; // ID3v2.2 uses 3-char frame ids — not supported
    expect(parseId3(tag)).toEqual({});
  });
});
