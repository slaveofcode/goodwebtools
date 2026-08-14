/**
 * Dependency-light PPTX (OOXML) reader that recovers each slide's *layout*:
 * every shape's position and size (EMU → px), its styled text runs, and its
 * images — so the viewer can render slides at their real geometry rather than
 * a flat text dump. It resolves inherited placeholder geometry from the slide
 * layout. It is still a lightweight reader (no masters chain, charts, SmartArt
 * or effects), not a full rendering engine.
 */
import { unzipSync, strFromU8 } from 'fflate';

/** 914400 EMU per inch ÷ 96 px per inch. */
const EMU_PER_PX = 9525;
const DEFAULT_W_EMU = 9144000; // 10in (4:3)
const DEFAULT_H_EMU = 6858000; // 7.5in

export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  sizePt: number | null;
  color: string | null; // #RRGGBB
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface Paragraph {
  runs: TextRun[];
  align: TextAlign;
}

export interface Shape {
  kind: 'text' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  paragraphs?: Paragraph[];
  imageKey?: string;
}

export interface PptxSlide {
  shapes: Shape[];
}

export interface PptxDoc {
  widthPx: number;
  heightPx: number;
  slides: PptxSlide[];
  media: Record<string, Uint8Array>;
}

interface Geo { x: number; y: number; w: number; h: number }

function emuToPx(emu: number): number {
  return Math.round(emu / EMU_PER_PX);
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function slideNumber(name: string): number {
  return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

/** Extract the a:off/a:ext transform from a shape block, in px. */
function parseXfrm(block: string): Geo | null {
  const off = block.match(/<a:off\b[^>]*>/)?.[0];
  const ext = block.match(/<a:ext\b[^>]*>/)?.[0];
  if (!off || !ext) return null;
  const x = off.match(/\bx="(-?\d+)"/)?.[1];
  const y = off.match(/\by="(-?\d+)"/)?.[1];
  const cx = ext.match(/\bcx="(\d+)"/)?.[1];
  const cy = ext.match(/\bcy="(\d+)"/)?.[1];
  if (x == null || y == null || cx == null || cy == null) return null;
  return { x: emuToPx(+x), y: emuToPx(+y), w: emuToPx(+cx), h: emuToPx(+cy) };
}

const ALIGN: Record<string, TextAlign> = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };

function parseParagraphs(txBody: string): Paragraph[] {
  const paras: Paragraph[] = [];
  for (const pm of txBody.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
    const body = pm[1];
    const align = ALIGN[body.match(/<a:pPr\b[^>]*\balgn="(\w+)"/)?.[1] ?? ''] ?? 'left';
    const runs: TextRun[] = [];
    for (const rm of body.matchAll(/<a:r\b[^>]*>([\s\S]*?)<\/a:r>/g)) {
      const run = rm[1];
      const t = run.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/);
      if (!t) continue;
      const rPr = run.match(/<a:rPr\b[^>]*>/)?.[0] ?? '';
      const sz = rPr.match(/\bsz="(\d+)"/)?.[1];
      const color = run.match(/<a:solidFill>\s*<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/)?.[1];
      runs.push({
        text: decodeXml(t[1]),
        bold: /\bb="1"/.test(rPr),
        italic: /\bi="1"/.test(rPr),
        sizePt: sz ? Number(sz) / 100 : null,
        color: color ? `#${color}` : null,
      });
    }
    if (runs.some(r => r.text.trim())) paras.push({ runs, align });
  }
  return paras;
}

function parseRels(xml: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const tag of xml.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = tag.match(/Id="([^"]+)"/)?.[1];
    const target = tag.match(/Target="([^"]+)"/)?.[1];
    if (id && target) map[id] = target;
  }
  return map;
}

function normalizeMedia(target: string): string {
  const cleaned = target.replace(/^\.\//, '');
  if (cleaned.startsWith('../')) return `ppt/${cleaned.slice(3)}`;
  if (cleaned.startsWith('/')) return cleaned.slice(1);
  return `ppt/slides/${cleaned}`;
}

function placeholderKey(block: string): string | null {
  const ph = block.match(/<p:ph\b[^>]*>/)?.[0] ?? block.match(/<p:ph\b[^>]*\/>/)?.[0];
  if (ph === undefined) return null;
  const tag = ph ?? '';
  const type = tag.match(/\btype="([^"]+)"/)?.[1] ?? 'body';
  const idx = tag.match(/\bidx="([^"]+)"/)?.[1] ?? '';
  return `${type}|${idx}`;
}

/** Build a placeholder-geometry map (key → px geo) from a slide layout XML. */
function layoutPlaceholders(xml: string): Record<string, Geo> {
  const map: Record<string, Geo> = {};
  for (const sm of xml.matchAll(/<p:sp\b[^>]*>([\s\S]*?)<\/p:sp>/g)) {
    const block = sm[1];
    const geo = parseXfrm(block);
    const key = placeholderKey(block);
    if (geo && key) {
      map[key] = geo;
      const [type, idx] = key.split('|');
      map[`${type}|`] ??= geo;
      map[`|${idx}`] ??= geo;
    }
  }
  return map;
}

function resolvePlaceholderGeo(block: string, layout: Record<string, Geo>): Geo | null {
  const key = placeholderKey(block);
  if (!key) return null;
  const [type, idx] = key.split('|');
  return layout[key] ?? layout[`${type}|`] ?? layout[`|${idx}`] ?? null;
}

function parseSlide(
  xml: string,
  rels: Record<string, string>,
  layout: Record<string, Geo>,
  media: Record<string, Uint8Array>,
): PptxSlide {
  const shapes: Shape[] = [];

  for (const sm of xml.matchAll(/<p:sp\b[^>]*>([\s\S]*?)<\/p:sp>/g)) {
    const block = sm[1];
    const txBody = block.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/);
    const paragraphs = txBody ? parseParagraphs(txBody[1]) : [];
    if (paragraphs.length === 0) continue;
    const geo = parseXfrm(block) ?? resolvePlaceholderGeo(block, layout);
    if (!geo) continue;
    shapes.push({ kind: 'text', ...geo, paragraphs });
  }

  for (const pm of xml.matchAll(/<p:pic\b[^>]*>([\s\S]*?)<\/p:pic>/g)) {
    const block = pm[1];
    const geo = parseXfrm(block);
    const embed = block.match(/r:embed="([^"]+)"/)?.[1];
    if (!geo || !embed) continue;
    const target = rels[embed];
    if (!target) continue;
    const key = normalizeMedia(target);
    if (key in media) shapes.push({ kind: 'image', ...geo, imageKey: key });
  }

  return { shapes };
}

/** Parse a .pptx file's bytes into positioned slides + media. */
export function parsePptx(bytes: Uint8Array): PptxDoc {
  const files = unzipSync(bytes);
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : '');

  const media: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith('ppt/media/')) media[name] = data;
  }

  const pres = read('ppt/presentation.xml');
  const sldSz = pres.match(/<p:sldSz\b[^>]*>/)?.[0] ?? '';
  const widthPx = emuToPx(Number(sldSz.match(/\bcx="(\d+)"/)?.[1] ?? DEFAULT_W_EMU));
  const heightPx = emuToPx(Number(sldSz.match(/\bcy="(\d+)"/)?.[1] ?? DEFAULT_H_EMU));

  const slideNames = Object.keys(files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const slides = slideNames.map(name => {
    const xml = read(name);
    const relsXml = read(name.replace(/^ppt\/slides\/(slide\d+)\.xml$/, 'ppt/slides/_rels/$1.xml.rels'));
    const rels = relsXml ? parseRels(relsXml) : {};

    // Resolve the slide's layout for inherited placeholder geometry.
    const layoutTarget = Object.entries(rels).find(([, t]) => t.includes('slideLayout'))?.[1];
    const layoutKey = layoutTarget ? normalizeMedia(layoutTarget) : '';
    const layout = layoutKey && files[layoutKey] ? layoutPlaceholders(read(layoutKey)) : {};

    return parseSlide(xml, rels, layout, media);
  });

  return { widthPx, heightPx, slides, media };
}
