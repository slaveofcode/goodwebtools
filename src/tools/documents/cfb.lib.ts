/**
 * Minimal reader for the OLE2 / Compound File Binary (CFB) container used by
 * legacy Office formats (.doc, .xls, .ppt). Reassembles each stream from the
 * FAT/mini-FAT sector chains and returns them by name. Pure — no I/O.
 *
 * Spec: [MS-CFB]. Only reading is implemented, enough to pull out named streams.
 */

const FREE = 0xffffffff;
const MAXREGSECT = 0xfffffffa;

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function isCompoundFile(bytes: Uint8Array): boolean {
  return bytes.length >= 8 &&
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1;
}

export function readCfb(bytes: Uint8Array): Map<string, Uint8Array> {
  if (!isCompoundFile(bytes)) throw new Error('Not an OLE2 compound file.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const sectorSize = 1 << dv.getUint16(0x1e, true);
  const miniSize = 1 << dv.getUint16(0x20, true);
  const firstDirSector = dv.getUint32(0x30, true);
  const miniCutoff = dv.getUint32(0x38, true);
  const firstMiniFat = dv.getUint32(0x3c, true);
  const firstDifat = dv.getUint32(0x44, true);

  const secOffset = (s: number) => (s + 1) * sectorSize;

  // Gather FAT sector locations from the header DIFAT (109 entries) then any
  // DIFAT sectors chained after it.
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const v = dv.getUint32(0x4c + i * 4, true);
    if (v <= MAXREGSECT) fatSectors.push(v);
  }
  let ds = firstDifat;
  const perSector = sectorSize / 4;
  let guard = 0;
  while (ds <= MAXREGSECT && guard++ < bytes.length) {
    const base = secOffset(ds);
    for (let i = 0; i < perSector - 1; i++) {
      const v = dv.getUint32(base + i * 4, true);
      if (v <= MAXREGSECT) fatSectors.push(v);
    }
    ds = dv.getUint32(base + (perSector - 1) * 4, true);
  }

  // Build the FAT (next-sector table).
  const fat: number[] = [];
  for (const fs of fatSectors) {
    const base = secOffset(fs);
    for (let i = 0; i < perSector; i++) fat.push(dv.getUint32(base + i * 4, true));
  }

  const readChain = (start: number): Uint8Array => {
    const parts: Uint8Array[] = [];
    let s = start;
    let g = 0;
    while (s <= MAXREGSECT && g++ < fat.length + 2) {
      const off = secOffset(s);
      parts.push(bytes.subarray(off, off + sectorSize));
      s = fat[s];
      if (s === undefined || s === FREE) break;
    }
    return concat(parts);
  };

  // Directory entries.
  const dir = readChain(firstDirSector);
  const ddv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  interface Entry { name: string; type: number; start: number; size: number; }
  const entries: Entry[] = [];
  for (let i = 0; (i + 1) * 128 <= dir.length; i++) {
    const b = i * 128;
    const type = dir[b + 0x42];
    if (type === 0) continue; // unused
    const nameLen = ddv.getUint16(b + 0x40, true);
    let name = '';
    for (let c = 0; c < Math.max(0, nameLen / 2 - 1); c++) name += String.fromCharCode(ddv.getUint16(b + c * 2, true));
    entries.push({ name, type, start: ddv.getUint32(b + 0x74, true), size: ddv.getUint32(b + 0x78, true) });
  }

  // Root storage (type 5) holds the mini stream.
  const root = entries.find(e => e.type === 5);
  const miniStream = root ? readChain(root.start) : new Uint8Array(0);
  const miniFatBytes = firstMiniFat <= MAXREGSECT ? readChain(firstMiniFat) : new Uint8Array(0);
  const mdv = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
  const miniFat: number[] = [];
  for (let i = 0; i < miniFatBytes.length / 4; i++) miniFat.push(mdv.getUint32(i * 4, true));

  const readMini = (start: number, size: number): Uint8Array => {
    const parts: Uint8Array[] = [];
    let s = start;
    let g = 0;
    while (s <= MAXREGSECT && g++ < miniFat.length + 2) {
      const off = s * miniSize;
      parts.push(miniStream.subarray(off, off + miniSize));
      s = miniFat[s];
      if (s === undefined || s === FREE) break;
    }
    return concat(parts).subarray(0, size);
  };

  const streams = new Map<string, Uint8Array>();
  for (const e of entries) {
    if (e.type !== 2) continue; // streams only
    const data = e.size < miniCutoff ? readMini(e.start, e.size) : readChain(e.start).subarray(0, e.size);
    streams.set(e.name, data);
  }
  return streams;
}
