import { useMemo, useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { searchMime } from '@/tools/dev/mime.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; placeholder: string; empty: string; ext: string; type: string }> = {
  en: {
    intro: 'Look up the MIME (content) type for a file extension, or find the extensions for a MIME type. Search by extension (jpg), type (image/png) or name (word). Runs in your browser.',
    placeholder: 'Search an extension, MIME type or name — e.g. svg, application/json, excel',
    empty: 'No MIME types match your search.',
    ext: 'Extension',
    type: 'MIME type',
  },
  id: {
    intro: 'Cari tipe MIME (content type) untuk sebuah ekstensi file, atau temukan ekstensi untuk sebuah tipe MIME. Cari berdasarkan ekstensi (jpg), tipe (image/png), atau nama (word). Berjalan di browser Anda.',
    placeholder: 'Cari ekstensi, tipe MIME, atau nama — mis. svg, application/json, excel',
    empty: 'Tidak ada tipe MIME yang cocok.',
    ext: 'Ekstensi',
    type: 'Tipe MIME',
  },
};

export default function MimeLookup({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchMime(query), [query]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t.placeholder}
        className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {results.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="space-y-2">
          {results.map((m, i) => (
            <li key={`${m.ext}-${m.mime}-${i}`} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <code className="rounded bg-accent/10 px-2 py-0.5 text-sm font-bold text-accent">.{m.ext}</code>
              <div className="min-w-0 flex-1">
                <code className="block truncate text-sm font-semibold">{m.mime}</code>
                <span className="text-xs text-muted-foreground">{m.name}</span>
              </div>
              <CopyButton value={m.mime} label="" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
