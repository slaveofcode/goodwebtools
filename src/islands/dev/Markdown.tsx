import { useEffect, useRef, useState } from 'react';
import { Upload, Pencil, Eye, Columns, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExpand } from '@/hooks/useExpand';
import { renderMarkdown, isMarkdownFile, titleFromFileName } from '@/tools/dev/markdown.lib';
import type { Lang } from '@/i18n/config';

const SAMPLE_EN = `# Hello, Markdown

Type on the **left**, see the preview on the **right** — or open a \`.md\` file to read it.

- Lists
- [Links](https://example.com)
- \`inline code\`

> Everything renders locally — nothing is uploaded.
`;

const SAMPLE_ID = `# Halo, Markdown

Ketik di **kiri**, lihat pratinjau di **kanan** — atau buka file \`.md\` untuk membacanya.

- Daftar
- [Tautan](https://example.com)
- \`inline code\`

> Semuanya dirender secara lokal — tidak ada yang diunggah.
`;

type ViewMode = 'edit' | 'preview' | 'split';

const TR: Record<Lang, {
  markdown: string; preview: string; sample: string;
  open: string; edit: string; view: string; split: string; dropHint: string; wrongType: string;
  expand: string; exit: string;
}> = {
  en: {
    markdown: 'Markdown', preview: 'Preview', sample: SAMPLE_EN,
    open: 'Open .md file', edit: 'Edit', view: 'Preview', split: 'Split',
    dropHint: 'Drop a Markdown file here to view it', wrongType: 'That doesn’t look like a Markdown file.',
    expand: 'Full screen', exit: 'Exit',
  },
  id: {
    markdown: 'Markdown', preview: 'Pratinjau', sample: SAMPLE_ID,
    open: 'Buka file .md', edit: 'Edit', view: 'Pratinjau', split: 'Split',
    dropHint: 'Jatuhkan file Markdown di sini untuk melihatnya', wrongType: 'Itu sepertinya bukan file Markdown.',
    expand: 'Layar penuh', exit: 'Keluar',
  },
};

export default function Markdown({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [input, setInput] = useState(t.sample);
  const [html, setHtml] = useState('');
  const [mode, setMode] = useState<ViewMode>('split');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { ref: expandRef, expanded, enter, exit } = useExpand<HTMLDivElement>();

  // marked + DOMPurify run browser-only; compute in an effect to stay SSR-safe.
  useEffect(() => {
    setHtml(renderMarkdown(input));
  }, [input]);

  async function loadFile(file: File) {
    if (!isMarkdownFile(file)) {
      setError(t.wrongType);
      return;
    }
    setError('');
    const text = await file.text();
    setInput(text);
    setFileName(file.name);
    setMode('preview'); // land in reading mode — ideal on a phone
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  const modeBtn = (m: ViewMode, label: string, Icon: typeof Pencil) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
      className={`inline-flex items-center gap-1.5 border-2 border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
        mode === m ? 'bg-accent text-accent-foreground shadow-brutal-sm' : 'hover:bg-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />{label}
    </button>
  );

  const showEditor = mode === 'edit' || mode === 'split';
  const showPreview = mode === 'preview' || mode === 'split';
  const paneHeight = expanded ? 'h-[calc(100vh-7rem)]' : 'h-[32rem]';

  return (
    <div
      ref={expandRef}
      className={expanded ? 'fixed inset-0 z-[60] space-y-3 overflow-auto bg-background p-4' : 'space-y-3'}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".md,.markdown,.mdown,.mkd,.mdx,.txt,text/markdown"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ''; }}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />{t.open}
        </Button>
        {fileName && <span className="truncate text-sm text-muted-foreground" title={titleFromFileName(fileName)}>{fileName}</span>}

        <div className="ml-auto flex gap-1">
          {modeBtn('edit', t.edit, Pencil)}
          {modeBtn('preview', t.view, Eye)}
          {modeBtn('split', t.split, Columns)}
          <button
            type="button"
            onClick={() => (expanded ? exit() : enter())}
            aria-label={expanded ? t.exit : t.expand}
            className="ml-1 inline-flex items-center gap-1.5 border-2 border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-muted"
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {expanded ? t.exit : t.expand}
          </button>
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

      <div className={`grid grid-cols-1 gap-4 ${mode === 'split' ? 'md:grid-cols-2' : ''} ${dragOver ? 'rounded outline-2 outline-dashed outline-accent' : ''}`}>
        {showEditor && (
          <label className="block space-y-1.5">
            <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.markdown}</span>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              spellCheck={false}
              className={`${paneHeight} w-full resize-y border-2 border-border bg-muted p-3 font-mono text-sm outline-none focus:shadow-brutal`}
            />
          </label>
        )}

        {showPreview && (
          <div className="space-y-1.5">
            <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.preview}</span>
            <div
              className={`markdown-preview ${paneHeight} overflow-auto border-2 border-border bg-muted p-4`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t.dropHint}</p>
    </div>
  );
}
