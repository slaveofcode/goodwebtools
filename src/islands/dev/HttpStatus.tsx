import { useMemo, useState } from 'react';
import { searchStatuses, CLASS_LABELS, type StatusClass } from '@/tools/dev/http-status.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; placeholder: string; empty: string }> = {
  en: {
    intro: 'Look up any HTTP status code — search by number (e.g. 422), class (e.g. 4xx) or name (e.g. "gateway"). Everything runs in your browser.',
    placeholder: 'Search a code, class or name — e.g. 404, 5xx, timeout',
    empty: 'No status codes match your search.',
  },
  id: {
    intro: 'Cari kode status HTTP mana pun — berdasarkan nomor (mis. 422), kelas (mis. 4xx), atau nama (mis. "gateway"). Semuanya berjalan di browser Anda.',
    placeholder: 'Cari kode, kelas, atau nama — mis. 404, 5xx, timeout',
    empty: 'Tidak ada kode status yang cocok.',
  },
};

const CLASS_STYLE: Record<StatusClass, string> = {
  '1xx': 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  '2xx': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  '3xx': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  '4xx': 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  '5xx': 'bg-red-500/15 text-red-600 dark:text-red-400',
};

export default function HttpStatus({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchStatuses(query), [query]);

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
          {results.map(s => (
            <li key={s.code} className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <code className="text-base font-bold">{s.code}</code>
                <span className="font-semibold">{s.name}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${CLASS_STYLE[s.category]}`}>
                  {CLASS_LABELS[s.category]}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
