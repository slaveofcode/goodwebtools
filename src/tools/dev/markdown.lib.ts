/**
 * Pure helpers for the Markdown Preview / viewer tool. Rendering runs
 * browser-side (DOMPurify needs a DOM) but is deterministic enough to unit-test
 * under jsdom.
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * The ESM default export can be either a ready sanitizer or a factory that
 * needs `window` (depends on bundler/runtime). Resolve it defensively so
 * `.sanitize` is always callable in the browser.
 */
function resolvePurifier(): { sanitize: (html: string) => string } | null {
  const dp = DOMPurify as unknown as {
    sanitize?: (html: string) => string;
  } & ((win: Window) => { sanitize: (html: string) => string });
  if (typeof dp.sanitize === 'function') return dp as { sanitize: (html: string) => string };
  if (typeof dp === 'function' && typeof window !== 'undefined') return dp(window);
  return null;
}

/** Parse Markdown to sanitized HTML. Returns '' if no sanitizer is available. */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  const purifier = resolvePurifier();
  return purifier ? purifier.sanitize(raw) : '';
}

const MD_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'];

/** Whether a picked/dropped file looks like Markdown (by extension or MIME). */
export function isMarkdownFile(file: { name?: string; type?: string }): boolean {
  const name = (file.name ?? '').toLowerCase();
  const type = (file.type ?? '').toLowerCase();
  if (type === 'text/markdown' || type === 'text/x-markdown') return true;
  return MD_EXTENSIONS.some(ext => name.endsWith(ext));
}

/** A document title from a file name: drop the extension, fall back to 'Untitled'. */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '').trim();
  return base || 'Untitled';
}
