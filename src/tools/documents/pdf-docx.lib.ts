/**
 * Reconstruct flow-document structure (lines → paragraphs → headings) from the
 * positioned text a PDF gives us. PDF has no paragraphs or reading order — just
 * glyphs at coordinates — so this heuristic layer is what makes a PDF→DOCX
 * conversion produce editable, reflowable text. Pure and unit-tested; the pdf.js
 * extraction, OCR fallback and .docx generation live in the island.
 *
 * Coordinate convention: top-down (origin top-left, y increases downward), so
 * sorting by y ascending yields natural reading order. Both the pdf.js and OCR
 * paths normalise into this before calling here.
 */

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocLine {
  text: string;
  x: number;
  y: number;
  height: number;
}

/** heading: 0 = body text, 1 = large heading, 2 = smaller heading. */
export interface DocParagraph {
  text: string;
  heading: 0 | 1 | 2;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Join x-sorted items into a line, inserting a space across visible gaps. */
function joinItems(items: TextItem[]): string {
  let out = '';
  let prevEnd: number | null = null;
  for (const it of items) {
    if (prevEnd !== null) {
      const gap = it.x - prevEnd;
      if (gap > it.height * 0.25 && !/\s$/.test(out) && !/^\s/.test(it.text)) out += ' ';
    }
    out += it.text;
    prevEnd = it.x + it.width;
  }
  return out;
}

/** Cluster text items sharing a baseline into lines, ordered top→bottom. */
export function groupLines(items: TextItem[], yTolRatio = 0.5): DocLine[] {
  const valid = items.filter((it) => it.text.length > 0);
  if (!valid.length) return [];
  const medH = median(valid.map((i) => i.height).filter((h) => h > 0)) || 1;
  const tol = medH * yTolRatio;

  const sorted = [...valid].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: TextItem[][] = [];
  for (const it of sorted) {
    const last = groups[groups.length - 1];
    const lastY = last ? last.reduce((s, g) => s + g.y, 0) / last.length : 0;
    if (last && Math.abs(it.y - lastY) <= tol) last.push(it);
    else groups.push([it]);
  }

  return groups
    .map((group) => {
      const g = [...group].sort((a, b) => a.x - b.x);
      return {
        text: joinItems(g).trim(),
        x: Math.min(...g.map((i) => i.x)),
        y: g.reduce((s, i) => s + i.y, 0) / g.length,
        height: Math.max(...g.map((i) => i.height)),
      };
    })
    .filter((l) => l.text.length > 0);
}

/** Merge lines into paragraphs, promoting noticeably larger lines to headings. */
export function paragraphsFromLines(lines: DocLine[]): DocParagraph[] {
  if (!lines.length) return [];
  const sorted = [...lines].sort((a, b) => a.y - b.y);
  const medH = median(sorted.map((l) => l.height)) || 1;

  const paras: DocParagraph[] = [];
  let cur: { texts: string[]; heading: 0 | 1 | 2 } | null = null;
  let prevY: number | null = null;

  const flush = () => {
    if (cur) paras.push({ text: cur.texts.join(' ').replace(/\s+/g, ' ').trim(), heading: cur.heading });
    cur = null;
  };

  for (const line of sorted) {
    const heading: 0 | 1 | 2 = line.height > medH * 1.9 ? 1 : line.height > medH * 1.35 ? 2 : 0;
    const gap = prevY === null ? 0 : line.y - prevY;
    // A heading is always its own paragraph; body lines join until a large gap.
    const newPara = cur === null || heading !== 0 || cur.heading !== 0 || gap > medH * 1.7;
    if (newPara) {
      flush();
      cur = { texts: [line.text], heading };
    } else if (cur) {
      cur.texts.push(line.text);
    }
    prevY = line.y;
  }
  flush();
  return paras.filter((p) => p.text.length > 0);
}

/** Positioned text items → structured paragraphs (the full reconstruction). */
export function reconstruct(items: TextItem[]): DocParagraph[] {
  return paragraphsFromLines(groupLines(items));
}

/* ------------------------------------------------------------------ *
 * Table-aware reconstruction: detect grid-like regions (rows whose text
 * splits into columns that line up across several rows) and emit them as
 * tables, with everything else falling back to paragraphs.
 * ------------------------------------------------------------------ */

export interface Segment { x: number; text: string; }
interface ItemRow { y: number; height: number; segs: Segment[]; }

export type DocBlock =
  | { type: 'paragraph'; text: string; heading: 0 | 1 | 2 }
  | { type: 'table'; rows: string[][] };

/** Group items into rows, keeping each row's items (not just joined text). */
function groupItemRows(items: TextItem[], yTolRatio = 0.5): TextItem[][] {
  // Drop whitespace-only items — pdf.js emits synthetic space items between
  // cells that would otherwise bridge column gaps and merge table cells.
  const valid = items.filter((it) => it.text.trim().length > 0);
  if (!valid.length) return [];
  const medH = median(valid.map((i) => i.height).filter((h) => h > 0)) || 1;
  const tol = medH * yTolRatio;
  const sorted = [...valid].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: TextItem[][] = [];
  for (const it of sorted) {
    const last = groups[groups.length - 1];
    const lastY = last ? last.reduce((s, g) => s + g.y, 0) / last.length : 0;
    if (last && Math.abs(it.y - lastY) <= tol) last.push(it);
    else groups.push([it]);
  }
  return groups.map((g) => [...g].sort((a, b) => a.x - b.x));
}

/** Split a row's items into cell segments, breaking on wide (column) gaps. */
export function segmentsOf(lineItems: TextItem[], gapFactor = 1): Segment[] {
  const sorted = [...lineItems].sort((a, b) => a.x - b.x);
  const segs: Segment[] = [];
  let text = '';
  let x = 0;
  let prevEnd: number | null = null;
  for (const it of sorted) {
    if (it.text.trim().length === 0) continue; // skip synthetic whitespace items
    if (prevEnd !== null && it.x - prevEnd > it.height * gapFactor) {
      if (text.trim()) segs.push({ x, text: text.trim() });
      text = '';
    }
    if (text === '') x = it.x;
    else if (prevEnd !== null && it.x - prevEnd > it.height * 0.2 && !/\s$/.test(text)) text += ' ';
    text += it.text;
    prevEnd = it.x + it.width;
  }
  if (text.trim()) segs.push({ x, text: text.trim() });
  return segs;
}

/** Cluster x positions into column centres (1-D agglomerative by tolerance). */
export function clusterColumns(xs: number[], tol: number): number[] {
  const sorted = [...xs].sort((a, b) => a - b);
  const cols: number[][] = [];
  for (const v of sorted) {
    const last = cols[cols.length - 1];
    const c = last ? last.reduce((s, n) => s + n, 0) / last.length : 0;
    if (last && Math.abs(v - c) <= tol) last.push(v);
    else cols.push([v]);
  }
  return cols.map((c) => c.reduce((s, n) => s + n, 0) / c.length);
}

const nearestCol = (x: number, cols: number[]): number => {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < cols.length; i++) {
    const d = Math.abs(x - cols[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
};

/**
 * Reconstruct a page's text items into a mix of paragraph and table blocks.
 * A table is a run of ≥2 adjacent rows that each split into ≥2 aligned columns.
 */
export function reconstructBlocks(items: TextItem[]): DocBlock[] {
  const itemRows = groupItemRows(items);
  if (!itemRows.length) return [];
  const medH = median(itemRows.flat().map((i) => i.height).filter((h) => h > 0)) || 1;

  const rows: ItemRow[] = itemRows.map((g) => ({
    y: g.reduce((s, i) => s + i.y, 0) / g.length,
    height: Math.max(...g.map((i) => i.height)),
    segs: segmentsOf(g),
  }));

  const blocks: DocBlock[] = [];
  let paraLines: DocLine[] = [];
  const flushParas = () => {
    if (!paraLines.length) return;
    for (const p of paragraphsFromLines(paraLines)) blocks.push({ type: 'paragraph', ...p });
    paraLines = [];
  };
  const asLine = (r: ItemRow): DocLine => ({
    text: r.segs.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim(),
    x: r.segs.length ? r.segs[0].x : 0,
    y: r.y,
    height: r.height,
  });

  let i = 0;
  while (i < rows.length) {
    // A table candidate starts on a multi-column row.
    if (rows[i].segs.length >= 2) {
      let j = i + 1;
      while (j < rows.length && rows[j].segs.length >= 2 && rows[j].y - rows[j - 1].y <= medH * 2.5) j++;
      const region = rows.slice(i, j);
      if (region.length >= 2) {
        const cols = clusterColumns(region.flatMap((r) => r.segs.map((s) => s.x)), medH * 1.5);
        if (cols.length >= 2) {
          flushParas();
          const grid = region.map((r) => {
            const cells = Array<string>(cols.length).fill('');
            for (const seg of r.segs) {
              const c = nearestCol(seg.x, cols);
              cells[c] = cells[c] ? `${cells[c]} ${seg.text}` : seg.text;
            }
            return cells;
          });
          blocks.push({ type: 'table', rows: grid });
          i = j;
          continue;
        }
      }
    }
    paraLines.push(asLine(rows[i]));
    i++;
  }
  flushParas();
  return blocks;
}

/** Count of non-whitespace characters — used to decide if a page needs OCR. */
export function textDensity(items: TextItem[]): number {
  return items.reduce((n, it) => n + it.text.replace(/\s/g, '').length, 0);
}
