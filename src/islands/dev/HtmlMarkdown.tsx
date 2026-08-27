import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { htmlToMarkdown, markdownToHtml } from '@/tools/dev/htmlmd.lib';
import type { Lang } from '@/i18n/config';

type Dir = 'h2m' | 'm2h';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Convert HTML to Markdown or Markdown to HTML, entirely in your browser. Nothing is uploaded.',
    h2m: 'HTML → Markdown', m2h: 'Markdown → HTML', swap: 'Swap',
    input: 'Input', output: 'Output', convert: 'Convert', copy: 'Copy', failed: 'Could not convert.',
  },
  id: {
    intro: 'Konversi HTML ke Markdown atau Markdown ke HTML, sepenuhnya di browser Anda. Tidak ada yang diunggah.',
    h2m: 'HTML → Markdown', m2h: 'Markdown → HTML', swap: 'Tukar',
    input: 'Masukan', output: 'Keluaran', convert: 'Konversi', copy: 'Salin', failed: 'Tidak dapat mengonversi.',
  },
};

export default function HtmlMarkdown({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [dir, setDir] = useState<Dir>('h2m');
  const [src, setSrc] = useState('<h1>Hello</h1>\n<p>A <strong>quick</strong> demo.</p>');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const convert = async () => {
    setBusy(true); setError('');
    try {
      setOut(dir === 'h2m' ? await htmlToMarkdown(src) : await markdownToHtml(src));
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const swap = () => {
    setDir(d => (d === 'h2m' ? 'm2h' : 'h2m'));
    setSrc(out || src);
    setOut('');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="border-2 border-border bg-accent px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-accent-foreground shadow-brutal-sm">
          {dir === 'h2m' ? t.h2m : t.m2h}
        </span>
        <Button variant="ghost" onClick={swap}><ArrowLeftRight className="h-4 w-4" />{t.swap}</Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.input}</span>
          <TextArea value={src} onChange={e => setSrc(e.target.value)} rows={12} className="font-mono text-sm" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.output}</span>
            <CopyButton value={out} label={t.copy} disabled={!out} />
          </div>
          <textarea readOnly value={out} rows={12} className="w-full border-2 border-border bg-muted p-2 font-mono text-sm" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={convert} disabled={busy || !src.trim()}>{busy ? '…' : t.convert}</Button>
    </div>
  );
}
