import { describe, it, expect } from 'vitest';
import { readExifSummary } from './exif.lib';

// Minimal JPEG APP1/Exif with one IFD0 tag: Orientation (0x0112) = 6.
function exifJpeg(): ArrayBuffer {
  const bytes: number[] = [0xff, 0xd8]; // SOI
  // Build TIFF body (big-endian) first so we know its length.
  const tiff: number[] = [];
  tiff.push(0x4d, 0x4d); // 'MM' big-endian
  tiff.push(0x00, 0x2a); // 42
  tiff.push(0x00, 0x00, 0x00, 0x08); // IFD0 offset = 8
  tiff.push(0x00, 0x01); // 1 entry
  tiff.push(0x01, 0x12); // tag Orientation
  tiff.push(0x00, 0x03); // type SHORT
  tiff.push(0x00, 0x00, 0x00, 0x01); // count 1
  tiff.push(0x00, 0x06, 0x00, 0x00); // value 6 (SHORT, left-justified)
  tiff.push(0x00, 0x00, 0x00, 0x00); // next IFD = 0
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0" + TIFF
  const len = exif.length + 2; // APP1 length includes the 2 length bytes
  bytes.push(0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...exif);
  bytes.push(0xff, 0xd9); // EOI
  return new Uint8Array(bytes).buffer;
}

describe('readExifSummary', () => {
  it('reads orientation from APP1', () => {
    const s = readExifSummary(exifJpeg());
    expect(s?.orientation).toBe(6);
    expect(s?.hasGps).toBe(false);
  });
  it('returns null when there is no Exif segment', () => {
    expect(readExifSummary(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBeNull();
  });
});
