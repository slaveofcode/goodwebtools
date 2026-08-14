import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { DownloadTextButton } from '@/components/ui/DownloadTextButton';
import { minifyHtml, minifyCss, minifyJs, type MinifyLang } from '@/tools/dev/minify.lib';
import type { Lang } from '@/i18n/config';

const LANGS: { key: MinifyLang; label: string; ext: string; mime: string }[] = [
  { key: 'html', label: 'HTML', ext: 'html', mime: 'text/html' },
  { key: 'css', label: 'CSS', ext: 'css', mime: 'text/css' },
  { key: 'js', label: 'JavaScript', ext: 'js', mime: 'text/javascript' },
];

const TR: Record<Lang, {
  intro: string;
  input: string;
  minify: string;
  working: string;
  output: string;
  saved: (pct: number, from: number, to: number) => string;
  failed: string;
}> = {
  en: {
    intro: 'Minify HTML, CSS or JavaScript to shrink file size — runs entirely in your browser, nothing is uploaded.',
    input: 'Source',
    minify: 'Minify',
    working: 'Minifying…',
    output: 'Minified',
    saved: (pct, from, to) => `${from} → ${to} bytes · saved ${pct}%`,
    failed: 'Could not minify — check the syntax.',
  },
  id: {
    intro: 'Minify HTML, CSS, atau JavaScript untuk memperkecil ukuran berkas — berjalan sepenuhnya di browser Anda, tidak ada yang diunggah.',
    input: 'Sumber',
    minify: 'Minify',
    working: 'Memproses…',
    output: 'Hasil minify',
    saved: (pct, from, to) => `${from} → ${to} bytes · hemat ${pct}%`,
    failed: 'Tidak dapat minify — periksa sintaksnya.',
  },
};

export default function Minifier({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [kind, setKind] = useState<MinifyLang>('css');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const active = LANGS.find(l => l.key === kind)!;

  const run = async () => {
    setBusy(true);
    setError('');
    setOutput('');
    try {
      const out = kind === 'html' ? minifyHtml(input) : kind === 'css' ? await minifyCss(input) : await minifyJs(input);
      setOutput(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const fromBytes = new Blob([input]).size;
  const toBytes = new Blob([output]).size;
  const pct = fromBytes > 0 && output ? Math.round((1 - toBytes / fromBytes) * 100) : 0;

  const segClass = (a: boolean) =>
    `border-2 px-3 py-1 text-sm font-medium transition-all ${a ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap gap-1">
        {LANGS.map(l => (
          <button key={l.key} onClick={() => { setKind(l.key); setOutput(''); setError(''); }}
            aria-pressed={kind === l.key} className={segClass(kind === l.key)}>{l.label}</button>
        ))}
      </div>

      <div className="space-y-1">
        <span className="block text-sm font-semibold">{t.input}</span>
        <TextArea value={input} onChange={e => setInput(e.target.value)} rows={8} spellCheck={false} />
      </div>

      <Button onClick={run} disabled={!input.trim() || busy}>{busy ? t.working : t.minify}</Button>

      {error && <Alert variant="error">{error}</Alert>}

      {output && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{t.output}</span>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">{t.saved(pct, fromBytes, toBytes)}</span>
            <div className="flex gap-2">
              <DownloadTextButton text={output} filename={`minified.${active.ext}`} mime={active.mime} />
              <CopyButton value={output} />
            </div>
          </div>
          <TextArea value={output} readOnly rows={8} spellCheck={false} />
        </div>
      )}
    </div>
  );
}
