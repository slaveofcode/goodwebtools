import { useMemo, useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { cleanUrls } from '@/tools/dev/url-clean.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; placeholder: string; upload: string; clean: string;
  removed: string; nothing: string; invalid: string; copyAll: string; summary: (u: number, p: number) => string;
}> = {
  en: {
    intro: 'Strip tracking parameters from links — utm_*, fbclid, gclid, si and more. Paste one or many URLs (one per line) or upload a .csv/.txt, and copy the clean versions. Runs entirely in your browser.',
    placeholder: 'Paste one URL per line…',
    upload: 'Upload .csv / .txt', clean: 'Clean URL',
    removed: 'Removed', nothing: 'already clean', invalid: 'not a valid URL',
    copyAll: 'Copy all clean URLs',
    summary: (u, p) => `${u} URL${u === 1 ? '' : 's'} · ${p} tracking parameter${p === 1 ? '' : 's'} removed`,
  },
  id: {
    intro: 'Hapus parameter pelacak dari tautan — utm_*, fbclid, gclid, si, dan lainnya. Tempel satu atau banyak URL (satu per baris) atau unggah .csv/.txt, lalu salin versi bersihnya. Berjalan sepenuhnya di browser Anda.',
    placeholder: 'Tempel satu URL per baris…',
    upload: 'Unggah .csv / .txt', clean: 'URL bersih',
    removed: 'Dihapus', nothing: 'sudah bersih', invalid: 'bukan URL valid',
    copyAll: 'Salin semua URL bersih',
    summary: (u, p) => `${u} URL · ${p} parameter pelacak dihapus`,
  },
};

export default function UrlStripper({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [input, setInput] = useState('');

  const results = useMemo(() => cleanUrls(input), [input]);
  const totalRemoved = results.reduce((n, r) => n + r.removed.length, 0);
  const allClean = results.filter(r => r.valid).map(r => r.clean).join('\n');

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    // Split CSV/TSV cells too, keeping anything that looks like a URL on its own line.
    const urls = text.split(/[\r\n,;\t]+/).map(s => s.trim().replace(/^"|"$/g, '')).filter(s => /^https?:\/\//i.test(s));
    setInput(prev => (prev ? prev + '\n' : '') + urls.join('\n'));
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        rows={5}
        placeholder={t.placeholder}
        className="w-full resize-y border-2 border-border bg-muted p-3 font-mono text-sm"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer border-2 border-border px-3 py-2 text-sm font-medium hover:shadow-brutal">
          {t.upload}
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onUpload} className="hidden" />
        </label>
        {results.length > 0 && <CopyButton value={allClean} label={t.copyAll} />}
      </div>

      {results.length > 0 && (
        <>
          <p className="text-sm font-semibold">{t.summary(results.length, totalRemoved)}</p>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="space-y-1 border-2 border-border p-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`break-all font-mono text-sm ${r.valid ? '' : 'text-red-600 dark:text-red-400'}`}>
                    {r.valid ? r.clean : `${r.original} — ${t.invalid}`}
                  </span>
                  {r.valid && <CopyButton value={r.clean} />}
                </div>
                {r.removed.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <span className="text-muted-foreground">{t.removed}:</span>
                    {r.removed.map(p => (
                      <span key={p} className="border border-border bg-red-500/20 px-1.5 py-0.5 font-mono line-through">{p}</span>
                    ))}
                  </div>
                ) : r.valid ? (
                  <span className="text-xs text-green-600 dark:text-green-400">✓ {t.nothing}</span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
