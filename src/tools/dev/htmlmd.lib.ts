/**
 * HTML ↔ Markdown conversion. The heavy libraries (turndown, marked) are
 * dynamic-imported so they stay out of the island's initial chunk. Markdown
 * output is rendered to HTML and sanitized with DOMPurify.
 */

/** Convert an HTML string to Markdown. */
export async function htmlToMarkdown(html: string): Promise<string> {
  const Turndown = (await import('turndown')).default;
  const service = new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  return service.turndown(html).trim();
}

/** Render a Markdown string to sanitized HTML. */
export async function markdownToHtml(md: string): Promise<string> {
  const { marked } = await import('marked');
  const DOMPurify = (await import('dompurify')).default;
  const raw = await marked.parse(md);
  return DOMPurify.sanitize(raw).trim();
}
