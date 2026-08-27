import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { beautify, BEAUTIFY_LANGS, type BeautifyLang } from '@/tools/dev/code-beautify.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Beautify and format code — JavaScript, TypeScript, CSS, HTML, JSON, Markdown and YAML — with Prettier, entirely in your browser. Nothing is uploaded.',
    language: 'Language', input: 'Input', output: 'Output', run: 'Beautify', copy: 'Copy',
    placeholder: 'Paste your code…', failed: 'Could not format — check the syntax.',
  },
  id: {
    intro: 'Percantik dan format kode — JavaScript, TypeScript, CSS, HTML, JSON, Markdown, dan YAML — dengan Prettier, sepenuhnya di browser Anda. Tidak ada yang diunggah.',
    language: 'Bahasa', input: 'Masukan', output: 'Keluaran', run: 'Percantik', copy: 'Salin',
    placeholder: 'Tempel kode Anda…', failed: 'Tidak dapat memformat — periksa sintaksnya.',
  },
};

export default function CodeBeautify({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [codeLang, setCodeLang] = useState<BeautifyLang>('js');
  const [src, setSrc] = useState('const greet=(name)=>{return "hi "+name}\nconsole.log(greet("world"))');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true); setError(''); setOut('');
    try {
      setOut(await beautify(src, codeLang));
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <label className="flex items-center gap-2 text-sm">
        <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.language}</span>
        <select value={codeLang} onChange={e => setCodeLang(e.target.value as BeautifyLang)} className="h-9 border-2 border-border bg-muted px-2">
          {BEAUTIFY_LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.input}</span>
          <TextArea value={src} onChange={e => setSrc(e.target.value)} rows={14} placeholder={t.placeholder} className="font-mono text-sm" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.output}</span>
            <CopyButton value={out} label={t.copy} disabled={!out} />
          </div>
          <textarea readOnly value={out} rows={14} className="w-full border-2 border-border bg-muted p-2 font-mono text-sm" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={run} disabled={busy || !src.trim()}>{busy ? '…' : t.run}</Button>
    </div>
  );
}
