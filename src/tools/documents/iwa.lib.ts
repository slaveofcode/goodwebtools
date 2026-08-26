/**
 * Reads the slide outline out of a Keynote (.key) file.
 *
 * Modern iWork documents embed only ONE preview image — a picture of the first
 * slide — so the preview alone can never show a whole deck. The real content
 * lives in `Index/Slide*.iwa`: Apple's "IWA" container, which is a sequence of
 * raw-snappy-compressed chunks whose payload is protobuf.
 *
 * We don't attempt to render slides (that would mean reimplementing Keynote's
 * layout engine). We recover the text of every slide and the order they play in:
 *
 *   - Each `Index/Slide*.iwa` holds one slide; its first archive's identifier is
 *     the slide's object id, and every TSWP.StorageArchive (message type 2001)
 *     carries the text runs in field 3.
 *   - `Index/Document.iwa` holds slide *node* archives (message type 4) whose
 *     field 2 references a slide id, plus a slide-tree archive that lists those
 *     nodes in presentation order. Sorting by object id is NOT equivalent —
 *     reordering slides in Keynote keeps the ids and rewrites the tree.
 *
 * Everything here is pure and defensive: malformed or truncated input yields an
 * empty result rather than throwing.
 */

/** Object-replacement character Keynote uses as a placeholder for inline items. */
const OBJECT_REPLACEMENT = /￼/g;

export interface SlideOutline {
  /** Object id of the slide inside the document. */
  id: number;
  /** First text run on the slide — usually the title. */
  title: string;
  /** Remaining text runs, in the order they appear. */
  body: string[];
}

/* ------------------------------------------------------------------ snappy */

/**
 * Decompress a raw snappy block (no stream framing).
 * Returns an empty array when the block is malformed.
 */
export function snappyDecompress(input: Uint8Array): Uint8Array {
  let p = 0;
  let shift = 0;
  let size = 0;
  for (;;) {
    if (p >= input.length || shift > 35) return new Uint8Array(0);
    const b = input[p++];
    size |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  if (size < 0 || size > 1 << 28) return new Uint8Array(0);

  const out = new Uint8Array(size);
  let o = 0;
  while (p < input.length && o < size) {
    const tag = input[p++];
    if ((tag & 3) === 0) {
      // Literal: length is (tag >> 2) + 1, or read extra bytes when >= 60.
      let n = tag >> 2;
      if (n >= 60) {
        const extra = n - 59;
        if (p + extra > input.length) return out.subarray(0, o);
        n = 0;
        for (let i = 0; i < extra; i++) n |= input[p + i] << (8 * i);
        p += extra;
      }
      n += 1;
      if (p + n > input.length || o + n > size) return out.subarray(0, o);
      out.set(input.subarray(p, p + n), o);
      p += n;
      o += n;
    } else {
      // Back-reference: copy `len` bytes from `offset` behind the write head.
      let len: number;
      let offset: number;
      if ((tag & 3) === 1) {
        if (p >= input.length) return out.subarray(0, o);
        len = 4 + ((tag >> 2) & 7);
        offset = ((tag >> 5) << 8) | input[p++];
      } else if ((tag & 3) === 2) {
        if (p + 2 > input.length) return out.subarray(0, o);
        len = (tag >> 2) + 1;
        offset = input[p] | (input[p + 1] << 8);
        p += 2;
      } else {
        if (p + 4 > input.length) return out.subarray(0, o);
        len = (tag >> 2) + 1;
        offset = input[p] | (input[p + 1] << 8) | (input[p + 2] << 16) | (input[p + 3] << 24);
        p += 4;
      }
      if (offset <= 0 || offset > o || o + len > size) return out.subarray(0, o);
      // Byte-by-byte on purpose: overlapping copies are legal in snappy.
      for (let i = 0; i < len; i++, o++) out[o] = out[o - offset];
    }
  }
  return out.subarray(0, o);
}

/**
 * Unwrap an .iwa file: a series of chunks, each a 4-byte header (one reserved
 * byte plus a 24-bit little-endian length) followed by a raw snappy block.
 */
export function decodeIwa(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let total = 0;
  let p = 0;
  while (p + 4 <= raw.length) {
    const len = raw[p + 1] | (raw[p + 2] << 8) | (raw[p + 3] << 16);
    p += 4;
    if (len <= 0 || p + len > raw.length) break;
    const chunk = snappyDecompress(raw.subarray(p, p + len));
    parts.push(chunk);
    total += chunk.length;
    p += len;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const part of parts) {
    out.set(part, o);
    o += part.length;
  }
  return out;
}

/* ---------------------------------------------------------------- protobuf */

export interface Field {
  no: number;
  /** Wire type: 0 varint, 1 fixed64, 2 length-delimited, 5 fixed32. */
  wire: number;
  /** Set for varint and fixed fields. */
  value: number;
  /** Set for length-delimited fields. */
  bytes?: Uint8Array;
}

/**
 * Walk the top-level fields of a protobuf message. Stops silently at the first
 * malformed byte — these payloads come from a format we only partly model.
 */
export function* readFields(buf: Uint8Array): Generator<Field> {
  let p = 0;
  while (p < buf.length) {
    let key = 0;
    let shift = 0;
    for (;;) {
      if (p >= buf.length || shift > 35) return;
      const b = buf[p++];
      key |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    const no = key >>> 3;
    const wire = key & 7;
    if (no === 0) return;

    if (wire === 0) {
      let value = 0;
      let s = 0;
      for (;;) {
        if (p >= buf.length || s > 63) return;
        const b = buf[p++];
        // Beyond 2^53 the number is no longer exact; ids never get that large.
        value += (b & 0x7f) * Math.pow(2, s);
        if ((b & 0x80) === 0) break;
        s += 7;
      }
      yield { no, wire, value };
    } else if (wire === 2) {
      let len = 0;
      let s = 0;
      for (;;) {
        if (p >= buf.length || s > 35) return;
        const b = buf[p++];
        len |= (b & 0x7f) << s;
        if ((b & 0x80) === 0) break;
        s += 7;
      }
      if (len < 0 || p + len > buf.length) return;
      yield { no, wire, value: len, bytes: buf.subarray(p, p + len) };
      p += len;
    } else if (wire === 5) {
      if (p + 4 > buf.length) return;
      yield { no, wire, value: buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16) | (buf[p + 3] << 24) };
      p += 4;
    } else if (wire === 1) {
      if (p + 8 > buf.length) return;
      let value = 0;
      for (let i = 7; i >= 0; i--) value = value * 256 + buf[p + i];
      yield { no, wire, value };
      p += 8;
    } else {
      return; // groups (3/4) and anything else: give up on this message
    }
  }
}

export interface ArchiveMessage {
  /** TSP message type, e.g. 2001 = TSWP.StorageArchive, 4 = KN.SlideNodeArchive. */
  type: number;
  payload: Uint8Array;
}

export interface Archive {
  id: number;
  messages: ArchiveMessage[];
}

/**
 * Split a decoded .iwa stream into archives. Each is a length-prefixed
 * ArchiveInfo (field 1 = object id, field 2 = repeated MessageInfo with the
 * type in field 1 and payload length in field 3) followed by those payloads.
 */
export function readArchives(decoded: Uint8Array): Archive[] {
  const out: Archive[] = [];
  let p = 0;
  while (p < decoded.length) {
    let len = 0;
    let shift = 0;
    for (;;) {
      if (p >= decoded.length || shift > 35) return out;
      const b = decoded[p++];
      len |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    if (len <= 0 || p + len > decoded.length) return out;

    const info = decoded.subarray(p, p + len);
    p += len;

    let id = 0;
    const sizes: { type: number; length: number }[] = [];
    for (const f of readFields(info)) {
      if (f.no === 1 && f.wire === 0) id = f.value;
      if (f.no === 2 && f.wire === 2 && f.bytes) {
        let type = 0;
        let length = 0;
        for (const g of readFields(f.bytes)) {
          if (g.no === 1 && g.wire === 0) type = g.value;
          if (g.no === 3 && g.wire === 0) length = g.value;
        }
        sizes.push({ type, length });
      }
    }

    const messages: ArchiveMessage[] = [];
    for (const s of sizes) {
      if (s.length < 0 || p + s.length > decoded.length) return out;
      messages.push({ type: s.type, payload: decoded.subarray(p, p + s.length) });
      p += s.length;
    }
    out.push({ id, messages });
  }
  return out;
}

/* ------------------------------------------------------------------- slides */

/** Tidy one text run; returns '' for runs that carry no readable text. */
export function cleanRun(text: string): string {
  return text.replace(OBJECT_REPLACEMENT, ' ').replace(/\s+/g, ' ').trim();
}

/** Every text run in a decoded slide archive, in document order. */
export function slideTextRuns(archives: Archive[]): string[] {
  const runs: string[] = [];
  for (const archive of archives) {
    for (const message of archive.messages) {
      if (message.type !== 2001) continue; // TSWP.StorageArchive
      for (const f of readFields(message.payload)) {
        if (f.no === 3 && f.wire === 2 && f.bytes) {
          const text = cleanRun(new TextDecoder().decode(f.bytes));
          if (text) runs.push(text);
        }
      }
    }
  }
  return runs;
}

/**
 * Read a TSP.Reference (a message whose field 1 is the object id) at a path of
 * nested field numbers, e.g. [1, 2] for a shape's owned text storage.
 */
export function readRefAt(payload: Uint8Array, path: number[]): number | null {
  let buf: Uint8Array | undefined = payload;
  for (const no of path) {
    let next: Uint8Array | undefined;
    for (const f of readFields(buf as Uint8Array)) {
      if (f.no === no && f.wire === 2 && f.bytes) { next = f.bytes; break; }
    }
    if (!next) return null;
    buf = next;
  }
  for (const f of readFields(buf as Uint8Array)) {
    if (f.no === 1 && f.wire === 0) return f.value;
  }
  return null;
}

/** Text of each TSWP.StorageArchive, keyed by object id. */
export function storageTexts(archives: Archive[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const archive of archives) {
    const runs = slideTextRuns([archive]);
    if (runs.length) out.set(archive.id, runs);
  }
  return out;
}

/**
 * Which text storage each shape owns (shape id → storage id).
 *
 * A plain text box (TSWP.ShapeInfo) points at its storage in field 2; a title or
 * body placeholder wraps that same shape one level deeper, so we try both.
 */
export function shapeStorages(archives: Archive[], storageIds: Set<number>): Map<number, number> {
  const out = new Map<number, number>();
  for (const archive of archives) {
    for (const message of archive.messages) {
      for (const path of [[2], [1, 2]]) {
        const ref = readRefAt(message.payload, path);
        if (ref !== null && storageIds.has(ref)) { out.set(archive.id, ref); break; }
      }
    }
  }
  return out;
}

export interface SlidePlaceholders {
  /** Object id of the title placeholder shape, if the slide has one. */
  title: number | null;
  /** Object id of the body placeholder shape, if the slide has one. */
  body: number | null;
  /** Every drawable on the slide, in the order the document lists them. */
  drawables: number[];
}

/**
 * Read the KN.SlideArchive (message type 5): field 5 references the title
 * placeholder, field 6 the body placeholder, and field 7 lists every drawable.
 */
export function slidePlaceholders(archives: Archive[]): SlidePlaceholders | null {
  for (const archive of archives) {
    for (const message of archive.messages) {
      if (message.type !== 5) continue;
      let title: number | null = null;
      let body: number | null = null;
      const drawables: number[] = [];
      for (const f of readFields(message.payload)) {
        if (f.wire !== 2 || !f.bytes) continue;
        let id: number | null = null;
        let only = true;
        let seen = 0;
        for (const g of readFields(f.bytes)) {
          seen++;
          if (g.no === 1 && g.wire === 0) id = g.value;
          else only = false;
        }
        if (id === null || !only || seen !== 1) continue;
        if (f.no === 5) title = id;
        else if (f.no === 6) body = id;
        else if (f.no === 7) drawables.push(id);
      }
      if (title !== null || body !== null || drawables.length) return { title, body, drawables };
    }
  }
  return null;
}

/**
 * Split a slide's text into its title and the rest.
 *
 * Uses the title/body placeholders so the heading matches what the slide
 * actually shows — archive order alone puts a subtitle before its title. Falls
 * back to plain document order for slides with no placeholder structure.
 */
export function slideContent(archives: Archive[]): { title: string; body: string[] } {
  const texts = storageTexts(archives);
  const placeholders = slidePlaceholders(archives);

  if (placeholders) {
    const shapes = shapeStorages(archives, new Set(texts.keys()));
    const textOf = (shapeId: number | null): string[] => {
      if (shapeId === null) return [];
      const storage = shapes.get(shapeId);
      return storage === undefined ? [] : texts.get(storage) ?? [];
    };

    const title = textOf(placeholders.title);
    const rest = [
      ...textOf(placeholders.body),
      ...placeholders.drawables
        .filter(id => id !== placeholders.title && id !== placeholders.body)
        .flatMap(textOf),
    ];
    const lines = [...title, ...rest];
    if (lines.length) return { title: lines[0], body: lines.slice(1) };
  }

  const runs = slideTextRuns(archives);
  return { title: runs[0] ?? '', body: runs.slice(1) };
}

/**
 * Presentation order of slide ids, read from Document.iwa.
 *
 * Slide-node archives (type 4) map a node id to a slide id; a tree archive then
 * lists node ids in play order. The theme's master slides use the same shape, so
 * we keep only the ordering whose slides actually exist in the document.
 */
export function slideOrder(documentArchives: Archive[], knownSlideIds: Set<number>): number[] {
  const nodeToSlide = new Map<number, number>();
  for (const archive of documentArchives) {
    for (const message of archive.messages) {
      if (message.type !== 4) continue; // KN.SlideNodeArchive
      for (const f of readFields(message.payload)) {
        if (f.no !== 2 || f.wire !== 2 || !f.bytes) continue;
        for (const g of readFields(f.bytes)) {
          if (g.no === 1 && g.wire === 0) nodeToSlide.set(archive.id, g.value);
        }
      }
    }
  }
  if (!nodeToSlide.size) return [];

  const collect = (buf: Uint8Array, found: number[], depth: number): void => {
    if (depth > 8) return;
    for (const f of readFields(buf)) {
      if (f.wire === 0 && nodeToSlide.has(f.value) && !found.includes(f.value)) found.push(f.value);
      else if (f.wire === 2 && f.bytes && f.bytes.length) collect(f.bytes, found, depth + 1);
    }
  };

  let best: number[] = [];
  for (const archive of documentArchives) {
    for (const message of archive.messages) {
      const nodes: number[] = [];
      collect(message.payload, nodes, 0);
      const slides = nodes
        .map(n => nodeToSlide.get(n) as number)
        .filter(id => knownSlideIds.has(id));
      if (slides.length > best.length) best = slides;
    }
  }
  return best;
}

/** Slide archive paths in a Keynote zip, excluding the theme's template slides. */
export function slideEntryNames(names: string[]): string[] {
  return names.filter(n => /^Index\/Slide[-.]/.test(n) && n.endsWith('.iwa'));
}

/**
 * Read the outline of every slide, in presentation order.
 * Returns an empty array for documents we can't parse (older iWork formats,
 * Pages/Numbers files, or anything malformed).
 */
export function readSlideOutline(entries: Record<string, Uint8Array>): SlideOutline[] {
  const names = slideEntryNames(Object.keys(entries));
  if (!names.length) return [];

  const slides = new Map<number, SlideOutline>();
  for (const name of names) {
    let archives: Archive[];
    try {
      archives = readArchives(decodeIwa(entries[name]));
    } catch {
      continue;
    }
    if (!archives.length) continue;
    slides.set(archives[0].id, { id: archives[0].id, ...slideContent(archives) });
  }
  if (!slides.size) return [];

  let ordered: number[] = [];
  const doc = entries['Index/Document.iwa'];
  if (doc) {
    try {
      ordered = slideOrder(readArchives(decodeIwa(doc)), new Set(slides.keys()));
    } catch {
      ordered = [];
    }
  }
  // Fall back to creation order when the tree is missing or incomplete.
  for (const id of [...slides.keys()].sort((a, b) => a - b)) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered.map(id => slides.get(id) as SlideOutline);
}
