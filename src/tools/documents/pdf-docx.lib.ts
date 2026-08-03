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

/** Count of non-whitespace characters — used to decide if a page needs OCR. */
export function textDensity(items: TextItem[]): number {
  return items.reduce((n, it) => n + it.text.replace(/\s/g, '').length, 0);
}
