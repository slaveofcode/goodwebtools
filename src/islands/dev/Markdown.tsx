import { useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Lang } from '@/i18n/config';

/**
 * The ESM default export can be either a ready sanitizer or a factory that
 * needs `window` (depends on bundler/runtime). Resolve it defensively so
 * `.sanitize` is always callable in the browser.
 */
function resolvePurifier(): { sanitize: (html: string) => string } | null {
  const dp = DOMPurify as unknown as {
    sanitize?: (html: string) => string;
  } & ((win: Window) => { sanitize: (html: string) => string });
  // Already a ready sanitizer.
  if (typeof dp.sanitize === 'function') return dp as { sanitize: (html: string) => string };
  // Factory form — instantiate with the browser window.
  if (typeof dp === 'function' && typeof window !== 'undefined') return dp(window);
  return null;
}

const SAMPLE_EN = `# Hello, Markdown

Type on the **left**, see the preview on the **right**.

- Lists
- [Links](https://example.com)
- \`inline code\`

> Everything renders locally — nothing is uploaded.
`;

const SAMPLE_ID = `# Halo, Markdown

Ketik di **kiri**, lihat pratinjau di **kanan**.

- Daftar
- [Tautan](https://example.com)
- \`inline code\`

> Semuanya dirender secara lokal — tidak ada yang diunggah.
`;

const TR: Record<Lang, { markdown: string; preview: string; sample: string }> = {
  en: { markdown: 'Markdown', preview: 'Preview', sample: SAMPLE_EN },
  id: { markdown: 'Markdown', preview: 'Pratinjau', sample: SAMPLE_ID },
};

export default function Markdown({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [input, setInput] = useState(t.sample);
  const [html, setHtml] = useState('');

  // marked + DOMPurify run browser-only (DOMPurify needs a DOM). Computing in
  // an effect keeps SSR safe and avoids a hydration mismatch.
  useEffect(() => {
    const purifier = resolvePurifier();
    const raw = marked.parse(input, { async: false }) as string;
    setHtml(purifier ? purifier.sanitize(raw) : '');
  }, [input]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="block space-y-1.5">
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.markdown}
        </span>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          spellCheck={false}
          className="h-[32rem] w-full resize-y border-2 border-border bg-muted p-3 font-mono text-sm outline-none focus:shadow-brutal"
        />
      </label>

      <div className="space-y-1.5">
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.preview}
        </span>
        <div
          className="markdown-preview h-[32rem] overflow-auto border-2 border-border bg-muted p-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
