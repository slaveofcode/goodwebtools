import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import ini from 'highlight.js/lib/languages/ini';

// Register only the languages we actually use (keeps the bundle small).
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('ini', ini); // also covers TOML (key = value, [tables])

export type CodeLanguage = 'json' | 'yaml' | 'xml' | 'ini' | 'plaintext';

interface CodeBlockProps {
  code: string;
  /** Language to highlight; 'plaintext' (default) renders without colors. */
  language?: CodeLanguage;
  className?: string;
}

/** A syntax-highlighted, scrollable code panel. */
export function CodeBlock({ code, language = 'plaintext', className = '' }: CodeBlockProps) {
  let html: string | null = null;
  if (language !== 'plaintext' && hljs.getLanguage(language)) {
    try {
      html = hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch {
      html = null;
    }
  }

  return (
    <pre
      className={`hljs max-h-[30rem] overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-sm ${className}`}
    >
      {html ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
    </pre>
  );
}
