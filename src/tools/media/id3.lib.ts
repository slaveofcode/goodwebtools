/**
 * Minimal ID3v2 (2.3 / 2.4) tag reader — title, artist, album and embedded
 * cover art. Pure and dependency-free; only reads the tag at the head of the
 * file, so the island can hand it just the first slice of an MP3.
 *
 * Unsupported/absent tags simply yield undefined fields — never throws.
 */

export interface Id3Picture { mime: string; data: Uint8Array }

export interface Id3Tags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  picture?: Id3Picture;
}

/** ID3 sizes are "synchsafe": 7 bits per byte. */
function synchsafe(b: Uint8Array, off: number): number {
  return ((b[off] & 0x7f) << 21) | ((b[off + 1] & 0x7f) << 14) | ((b[off + 2] & 0x7f) << 7) | (b[off + 3] & 0x7f);
}

function uint32(b: Uint8Array, off: number): number {
  return ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
}

const decode = (bytes: Uint8Array, label: string): string => {
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return '';
  }
};

/** Decode an ID3 text payload whose first byte is the encoding marker. */
function decodeText(payload: Uint8Array): string {
  if (payload.length === 0) return '';
  const enc = payload[0];
  const body = payload.subarray(1);
  let out: string;
  if (enc === 1) out = decode(body, 'utf-16');       // UTF-16 with BOM
  else if (enc === 2) out = decode(body, 'utf-16be');
  else if (enc === 3) out = decode(body, 'utf-8');
  else out = decode(body, 'iso-8859-1');
  // Trim trailing NULs / whitespace.
  return out.replace(/\0+$/, '').trim();
}

/** Read a NUL-terminated string; returns [text, nextOffset]. */
function readNullTerminated(b: Uint8Array, start: number, wide: boolean): [string, number] {
  if (wide) {
    let i = start;
    while (i + 1 < b.length && !(b[i] === 0 && b[i + 1] === 0)) i += 2;
    return [decode(b.subarray(start, i), 'utf-16'), i + 2];
  }
  let i = start;
  while (i < b.length && b[i] !== 0) i++;
  return [decode(b.subarray(start, i), 'iso-8859-1'), i + 1];
}

function parsePicture(payload: Uint8Array): Id3Picture | undefined {
  if (payload.length < 4) return undefined;
  const enc = payload[0];
  const wide = enc === 1 || enc === 2;
  const [mime, afterMime] = readNullTerminated(payload, 1, false);
  if (afterMime >= payload.length) return undefined;
  // Skip the picture-type byte, then the (possibly wide) description.
  const [, afterDesc] = readNullTerminated(payload, afterMime + 1, wide);
  if (afterDesc >= payload.length) return undefined;
  const data = payload.subarray(afterDesc);
  if (!data.length) return undefined;
  return { mime: mime || 'image/jpeg', data };
}

/** Parse ID3v2 tags from the start of a file. Returns {} when absent/invalid. */
export function parseId3(bytes: Uint8Array): Id3Tags {
  const tags: Id3Tags = {};
  if (bytes.length < 10) return tags;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return tags; // "ID3"
  const major = bytes[3];
  if (major !== 3 && major !== 4) return tags;
  const tagSize = synchsafe(bytes, 6);
  const end = Math.min(bytes.length, 10 + tagSize);

  let off = 10;
  while (off + 10 <= end) {
    const id = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break; // padding or corruption
    // v2.4 uses synchsafe frame sizes; v2.3 uses plain uint32.
    const size = major === 4 ? synchsafe(bytes, off + 4) : uint32(bytes, off + 4);
    const start = off + 10;
    if (size <= 0 || start + size > end) break;
    const payload = bytes.subarray(start, start + size);
    switch (id) {
      case 'TIT2': tags.title = decodeText(payload); break;
      case 'TPE1': tags.artist = decodeText(payload); break;
      case 'TALB': tags.album = decodeText(payload); break;
      case 'TYER': case 'TDRC': tags.year = decodeText(payload); break;
      case 'APIC': tags.picture = parsePicture(payload); break;
      default: break;
    }
    off = start + size;
  }
  return tags;
}
