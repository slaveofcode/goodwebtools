export interface IcoEntry {
  width: number;
  height: number;
  bpp: number;
  offset: number;
  size: number;
}

/** Parse an .ico ICONDIR into its per-image entries. Returns [] if not an ICO. */
export function parseIcoEntries(buffer: ArrayBuffer): IcoEntry[] {
  if (buffer.byteLength < 6) return [];
  const v = new DataView(buffer);
  if (v.getUint16(0, true) !== 0 || v.getUint16(2, true) !== 1) return []; // reserved=0, type=1
  const count = v.getUint16(4, true);
  const entries: IcoEntry[] = [];
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    if (e + 16 > buffer.byteLength) break;
    const w = v.getUint8(e) || 256; // 0 means 256
    const h = v.getUint8(e + 1) || 256;
    entries.push({
      width: w,
      height: h,
      bpp: v.getUint16(e + 6, true),
      size: v.getUint32(e + 8, true),
      offset: v.getUint32(e + 12, true),
    });
  }
  return entries;
}
