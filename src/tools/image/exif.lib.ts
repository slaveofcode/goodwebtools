export interface ExifSummary {
  orientation?: number;
  hasGps: boolean;
}

/**
 * Minimal EXIF reader: scans JPEG APP1 for the Exif TIFF block and reads the
 * IFD0 Orientation tag (0x0112) and whether a GPS IFD pointer (0x8825) exists.
 * Returns null when there's no Exif segment. No external dependency.
 */
export function readExifSummary(buffer: ArrayBuffer): ExifSummary | null {
  const v = new DataView(buffer);
  if (buffer.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null; // not a JPEG

  // Walk JPEG markers to find APP1 (0xFFE1) starting with "Exif\0\0".
  let p = 2;
  while (p + 4 <= buffer.byteLength) {
    if (v.getUint8(p) !== 0xff) break;
    const marker = v.getUint8(p + 1);
    const segLen = v.getUint16(p + 2);
    if (marker === 0xe1 && p + 4 + 6 <= buffer.byteLength) {
      const isExif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00].every((b, i) => v.getUint8(p + 4 + i) === b);
      if (isExif) return readTiff(v, p + 10); // TIFF header starts after "Exif\0\0"
    }
    if (marker === 0xda) break; // start of scan — no more metadata
    p += 2 + segLen;
  }
  return null;
}

function readTiff(v: DataView, base: number): ExifSummary {
  const little = v.getUint16(base) === 0x4949; // 'II' little-endian, 'MM' big-endian
  const u16 = (o: number) => v.getUint16(base + o, little);
  const u32 = (o: number) => v.getUint32(base + o, little);

  const ifd0 = u32(4);
  const summary: ExifSummary = { hasGps: false };
  if (ifd0 + 2 > v.byteLength - base) return summary;
  const count = u16(ifd0);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    const tag = u16(entry);
    if (tag === 0x0112) summary.orientation = u16(entry + 8); // Orientation (SHORT, inline)
    if (tag === 0x8825) summary.hasGps = true; // GPS IFD pointer present
  }
  return summary;
}
