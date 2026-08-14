/**
 * Client-side minifiers. CSS via csso and JS via terser (both dynamic-imported
 * so they stay out of the island chunk). HTML is a conservative hand-rolled
 * whitespace/comment collapser that preserves whitespace-sensitive elements.
 */

export type MinifyLang = 'html' | 'css' | 'js';

/** Minify CSS with csso. */
export async function minifyCss(css: string): Promise<string> {
  const csso = await import('csso');
  return csso.minify(css).css;
}

/** Minify JavaScript with terser. */
export async function minifyJs(js: string): Promise<string> {
  const { minify } = await import('terser');
  const out = await minify(js, { format: { comments: false } });
  return out.code ?? '';
}

// Control-char sentinels that won't collide with real text or be treated as
// whitespace by the collapse steps.
const OPEN = '';
const CLOSE = '';

/**
 * Minify HTML: strip comments (keeping IE conditionals), collapse whitespace
 * between and within tags, but leave the contents of <pre>, <textarea>,
 * <script> and <style> untouched.
 */
export function minifyHtml(html: string): string {
  const kept: string[] = [];

  // Protect whitespace-sensitive / code blocks.
  let out = html.replace(
    /<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    m => `${OPEN}${kept.push(m) - 1}${CLOSE}`,
  );

  // Drop comments except downlevel IE conditionals.
  out = out.replace(/<!--(?!\s*\[if)[\s\S]*?-->/g, '');
  // Collapse whitespace between tags and runs of whitespace inside text.
  out = out.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();

  // Restore protected blocks.
  return out.replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g'), (_, i) => kept[Number(i)]);
}
