import { unzipSync, strFromU8 } from 'fflate';

/**
 * A license-clean ODF (OpenDocument Text) → HTML renderer. An .odt is a ZIP of
 * XML; we unzip with fflate and parse content.xml/styles.xml with the browser's
 * native DOMParser, then map a practical subset of ODF to HTML. Output is safe
 * *by construction* — only a fixed whitelist of tags is emitted, every text node
 * and attribute value is escaped, hrefs are scheme-checked, and inline CSS values
 * are validated. No third-party rendering engine, no AGPL dependency.
 */

export interface OdtParts {
  contentXml: string;
  stylesXml: string;
  images: Record<string, Uint8Array>;
}

/** Unzip an .odt and pull out the XML parts + embedded Pictures. */
export function unzipOdt(bytes: Uint8Array): OdtParts {
  const files = unzipSync(bytes);
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : '');
  const contentXml = read('content.xml');
  if (!contentXml) throw new Error('Not an ODT document: content.xml is missing.');
  const images: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith('Pictures/')) images[name] = data;
  }
  return { contentXml, stylesXml: read('styles.xml'), images };
}

type Css = Record<string, string>;
interface StyleEntry { css: Css; parent?: string }
interface Ctx {
  styleMap: Map<string, StyleEntry>;
  listOrdered: Map<string, boolean>;
  resolveImage: (href: string) => string | null;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c]);
}

/** Reject CSS values that could break out of the style="" attribute or inject. */
function safeVal(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  if (!t || /[<>"();{}]/.test(t)) return null;
  return t;
}

function childByLocal(parent: Element, local: string): Element | null {
  for (const el of Array.from(parent.children)) if (el.localName === local) return el;
  return null;
}
function deepFirstLocal(root: Element | Document, local: string): Element | null {
  for (const el of Array.from(root.getElementsByTagName('*'))) if (el.localName === local) return el;
  return null;
}

/** Extract the CSS we support from a <style:style>'s text/paragraph properties. */
function extractCss(s: Element): Css {
  const css: Css = {};
  const tp = childByLocal(s, 'text-properties');
  if (tp) {
    const set = (prop: string, raw: string | null) => {
      const v = safeVal(raw);
      if (v) css[prop] = v;
    };
    set('font-weight', tp.getAttribute('fo:font-weight'));
    set('font-style', tp.getAttribute('fo:font-style'));
    set('color', tp.getAttribute('fo:color'));
    set('font-size', tp.getAttribute('fo:font-size'));
    const bg = tp.getAttribute('fo:background-color');
    if (bg && bg !== 'transparent') set('background-color', bg);
    const deco: string[] = [];
    const ul = tp.getAttribute('style:text-underline-style');
    const lt = tp.getAttribute('style:text-line-through-style');
    if (ul && ul !== 'none') deco.push('underline');
    if (lt && lt !== 'none') deco.push('line-through');
    if (deco.length) css['text-decoration'] = deco.join(' ');
  }
  const pp = childByLocal(s, 'paragraph-properties');
  if (pp) {
    const ta = pp.getAttribute('fo:text-align');
    if (ta) css['text-align'] = ta === 'start' ? 'left' : ta === 'end' ? 'right' : ta;
  }
  return css;
}

function buildStyleMap(docs: (Document | null)[]): Map<string, StyleEntry> {
  const map = new Map<string, StyleEntry>();
  for (const doc of docs) {
    if (!doc) continue;
    for (const s of Array.from(doc.getElementsByTagName('*'))) {
      if (s.localName !== 'style') continue; // style:style
      const name = s.getAttribute('style:name');
      if (!name) continue;
      map.set(name, { css: extractCss(s), parent: s.getAttribute('style:parent-style-name') || undefined });
    }
  }
  return map;
}

function buildListStyleMap(docs: (Document | null)[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const doc of docs) {
    if (!doc) continue;
    for (const ls of Array.from(doc.getElementsByTagName('*'))) {
      if (ls.localName !== 'list-style') continue; // text:list-style
      const name = ls.getAttribute('style:name');
      if (!name) continue;
      map.set(name, !!deepFirstLocal(ls, 'list-level-style-number'));
    }
  }
  return map;
}

/** Merge a style with its parent chain into a single CSS object. */
function resolvedCss(map: Map<string, StyleEntry>, name: string | null): Css {
  const chain: StyleEntry[] = [];
  const seen = new Set<string>();
  let cur = name;
  while (cur && map.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    const entry = map.get(cur)!;
    chain.unshift(entry);
    cur = entry.parent;
  }
  const out: Css = {};
  for (const c of chain) Object.assign(out, c.css);
  return out;
}

function cssAttr(css: Css): string {
  const s = Object.entries(css).map(([k, v]) => `${k}:${v}`).join(';');
  return s ? ` style="${esc(s)}"` : '';
}
function styleAttrFor(ctx: Ctx, el: Element): string {
  return cssAttr(resolvedCss(ctx.styleMap, el.getAttribute('text:style-name')));
}

function sanitizeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  if (h.startsWith('#') || h.startsWith('/') || !h.includes(':')) return h; // anchor / relative
  return null;
}

function renderFrame(el: Element, ctx: Ctx): string {
  const img = deepFirstLocal(el, 'image');
  const href = img?.getAttribute('xlink:href') || '';
  const url = href ? ctx.resolveImage(href) : null;
  if (!url) return '';
  const alt = esc(deepFirstLocal(el, 'desc')?.textContent?.trim() || deepFirstLocal(el, 'title')?.textContent?.trim() || '');
  const w = safeVal(el.getAttribute('svg:width'));
  const h = safeVal(el.getAttribute('svg:height'));
  let style = 'max-width:100%;height:auto;';
  if (w) style += `width:${w};`;
  if (h) style += `height:${h};`;
  return `<img src="${esc(url)}" alt="${alt}" style="${esc(style)}">`;
}

function renderChildren(el: Element, ctx: Ctx, inheritedOrdered: boolean): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) out += esc(node.nodeValue ?? '');
    else if (node.nodeType === 1) out += renderEl(node as Element, ctx, inheritedOrdered);
  }
  return out;
}

function renderEl(el: Element, ctx: Ctx, inheritedOrdered: boolean): string {
  const kids = () => renderChildren(el, ctx, inheritedOrdered);
  switch (el.localName) {
    case 'h': {
      const lvl = Math.min(6, Math.max(1, parseInt(el.getAttribute('text:outline-level') || '1', 10) || 1));
      return `<h${lvl}${styleAttrFor(ctx, el)}>${kids()}</h${lvl}>`;
    }
    case 'p':
      return `<p${styleAttrFor(ctx, el)}>${kids()}</p>`;
    case 'span':
      return `<span${styleAttrFor(ctx, el)}>${kids()}</span>`;
    case 'a': {
      const href = sanitizeHref(el.getAttribute('xlink:href') || '');
      return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${kids()}</a>` : kids();
    }
    case 'line-break':
      return '<br>';
    case 'tab':
      return '&emsp;';
    case 's': {
      const n = Math.min(50, Math.max(1, parseInt(el.getAttribute('text:c') || '1', 10) || 1));
      return '&nbsp;'.repeat(n);
    }
    case 'list': {
      const sn = el.getAttribute('text:style-name');
      const ordered = sn && ctx.listOrdered.has(sn) ? ctx.listOrdered.get(sn)! : inheritedOrdered;
      const tag = ordered ? 'ol' : 'ul';
      return `<${tag}>${renderChildren(el, ctx, ordered)}</${tag}>`;
    }
    case 'list-item':
      return `<li>${renderChildren(el, ctx, inheritedOrdered)}</li>`;
    case 'table':
      return `<table class="odt-table">${kids()}</table>`;
    case 'table-row':
      return `<tr>${kids()}</tr>`;
    case 'table-cell': {
      const cs = parseInt(el.getAttribute('table:number-columns-spanned') || '1', 10);
      const rs = parseInt(el.getAttribute('table:number-rows-spanned') || '1', 10);
      const attrs = (cs > 1 ? ` colspan="${cs}"` : '') + (rs > 1 ? ` rowspan="${rs}"` : '');
      return `<td${attrs}>${kids()}</td>`;
    }
    case 'covered-table-cell':
    case 'table-column':
    case 'sequence-decls':
    case 'tracked-changes':
      return '';
    case 'frame':
      return renderFrame(el, ctx);
    case 'image':
      return ''; // handled by its enclosing frame
    default:
      return kids(); // unwrap unknown inline/containers, keep their text
  }
}

/**
 * Convert ODF content.xml (+ optional styles.xml) into a safe HTML string.
 * `resolveImage(href)` turns a `Pictures/…` reference into a usable URL (e.g. a
 * blob URL the caller owns) or null to drop the image.
 */
export function odtToHtml(contentXml: string, stylesXml: string, resolveImage: (href: string) => string | null): string {
  const parser = new DOMParser();
  const content = parser.parseFromString(contentXml, 'application/xml');
  if (content.getElementsByTagName('parsererror').length) return '';
  const styles = stylesXml ? parser.parseFromString(stylesXml, 'application/xml') : null;
  const body = deepFirstLocal(content, 'text'); // office:text
  if (!body) return '';
  const ctx: Ctx = {
    styleMap: buildStyleMap([styles, content]),
    listOrdered: buildListStyleMap([styles, content]),
    resolveImage,
  };
  return renderChildren(body, ctx, false);
}
