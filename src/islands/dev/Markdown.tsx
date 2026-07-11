import { useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const SAMPLE = `# Hello, Markdown

Type on the **left**, see the preview on the **right**.

- Lists
- [Links](https://example.com)
- \`inline code\`

> Everything renders locally — nothing is uploaded.
`;

export default function Markdown() {
  const [input, setInput] = useState(SAMPLE);
  const [html, setHtml] = useState('');

  // marked + DOMPurify run browser-only (DOMPurify needs a DOM). Computing in
  // an effect keeps SSR safe and avoids a hydration mismatch.
  useEffect(() => {
    const raw = marked.parse(input, { async: false }) as string;
    setHtml(DOMPurify.sanitize(raw));
  }, [input]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-muted-foreground">Markdown</span>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          spellCheck={false}
          className="h-[32rem] w-full resize-y rounded-lg border border-border bg-muted/40 p-3 font-mono text-sm outline-none focus:border-accent"
        />
      </label>

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-muted-foreground">Preview</span>
        <div
          className="markdown-preview h-[32rem] overflow-auto rounded-lg border border-border bg-muted/40 p-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
