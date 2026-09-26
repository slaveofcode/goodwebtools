import { describe, it, expect, vi } from 'vitest';
import { sniffMagic, sniffFileMeta } from './fileMeta';

const u8 = (...b: number[]) => new Uint8Array(b);

describe('sniffMagic', () => {
  it.each([
    ['jpeg', u8(0xff, 0xd8, 0xff, 0xe0)],
    ['png', u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ['gif', u8(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)],
    ['pdf', u8(0x25, 0x50, 0x44, 0x46, 0x2d)],
  ])('detects %s', (fmt, bytes) => {
    expect(sniffMagic(bytes)).toBe(fmt);
  });

  it('detects webp (RIFF....WEBP)', () => {
    expect(sniffMagic(u8(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe('webp');
  });

  it('detects heic (ftyp heic)', () => {
    const bytes = u8(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
    expect(sniffMagic(bytes)).toBe('heic');
  });

  it('returns "unknown" for unrecognized bytes', () => {
    expect(sniffMagic(u8(1, 2, 3, 4))).toBe('unknown');
  });
});

describe('sniffFileMeta', () => {
  it('reports claimed vs actual format and marks a non-decodable image', async () => {
    // A file that claims JPEG but whose bytes are actually HEIC — the classic case.
    const heic = u8(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
    const file = new File([heic], 'photo.jpeg', { type: 'image/jpeg', lastModified: 123 });
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('cannot decode')));
    const meta = await sniffFileMeta(file);
    expect(meta.claimedType).toBe('image/jpeg');
    expect(meta.actualFormat).toBe('heic');
    expect(meta.size).toBe(heic.byteLength);
    expect(meta.decodeOk).toBe(false);
    vi.unstubAllGlobals();
  });
});
