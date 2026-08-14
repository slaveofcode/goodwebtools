/**
 * Minimal, dependency-light PPTX (OOXML) reader — pulls slide text and image
 * references out of a .pptx zip. It is a lightweight viewer, not a
 * pixel-perfect renderer: it surfaces each slide's text paragraphs (in order)
 * and its embedded images, which covers the common "what's in these slides"
 * need without a heavyweight rendering engine.
 */
import { unzipSync, strFromU8 } from 'fflate';

export interface PptxSlide {
  /** Text paragraphs on the slide, in document order. */
  paragraphs: string[];
  /** Media keys (into `PptxDoc.media`) for images on the slide. */
  images: string[];
}

export interface PptxDoc {
  slides: PptxSlide[];
  /** Raw bytes of every ppt/media/* entry, keyed by path. */
  media: Record<string, Uint8Array>;
}

function slideNumber(name: string): number {
  return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
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

/**
 * Pull each paragraph's text out of a slide XML. Uses regex rather than
 * DOMParser so it behaves identically in the browser and under test, and
 * needs no DOM. OOXML nests `<a:t>` text runs inside `<a:p>` paragraphs.
 */
function extractParagraphs(xml: string): string[] {
  const out: string[] = [];
  for (const pm of xml.matchAll(/<(?:[a-zA-Z]+:)?p\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z]+:)?p>/g)) {
    const runs = Array.from(pm[1].matchAll(/<(?:[a-zA-Z]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z]+:)?t>/g));
    const text = runs.map(m => decodeXml(m[1])).join('');
    if (text.trim()) out.push(text);
  }
  return out;
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

/** Resolve a slide-relative rels target (e.g. "../media/image1.png") to a zip key. */
function normalizeMedia(target: string): string {
  const cleaned = target.replace(/^\.\//, '');
  if (cleaned.startsWith('../')) return `ppt/${cleaned.slice(3)}`;
  if (cleaned.startsWith('/')) return cleaned.slice(1);
  return `ppt/slides/${cleaned}`;
}

/** Parse a .pptx file's bytes into ordered slides + media. */
export function parsePptx(bytes: Uint8Array): PptxDoc {
  const files = unzipSync(bytes);

  const media: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith('ppt/media/')) media[name] = data;
  }

  const slideNames = Object.keys(files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const slides: PptxSlide[] = slideNames.map(name => {
    const xml = strFromU8(files[name]);
    const paragraphs = extractParagraphs(xml);

    const relsName = name.replace(/^ppt\/slides\/(slide\d+)\.xml$/, 'ppt/slides/_rels/$1.xml.rels');
    const rels = files[relsName] ? parseRels(strFromU8(files[relsName])) : {};
    const embeds = Array.from(xml.matchAll(/r:embed="([^"]+)"/g)).map(m => m[1]);
    const images = embeds
      .map(id => rels[id])
      .filter((tgt): tgt is string => Boolean(tgt))
      .map(normalizeMedia)
      .filter(key => key in media);

    return { paragraphs, images };
  });

  return { slides, media };
}
