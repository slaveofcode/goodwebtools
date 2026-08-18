import { useMemo, useState } from 'react';
import { searchGlyphs, GLYPH_GROUPS, type Glyph } from '@/tools/dev/emoji.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; placeholder: string; copied: string; empty: string; hint: string }> = {
  en: {
    intro: 'Find and copy emoji and special characters — the em dash —, degree °, ± , currency symbols, arrows and more. Click any character to copy it. Runs in your browser.',
    placeholder: 'Search — e.g. em dash, degree, euro, shrug, arrow, pi',
    copied: 'Copied', empty: 'No characters match your search.',
    hint: 'Tip: search by name or keyword. Click a character to copy it to your clipboard.',
  },
  id: {
    intro: 'Temukan dan salin emoji serta karakter spesial — em dash —, derajat °, ± , simbol mata uang, panah, dan lainnya. Klik karakter mana pun untuk menyalinnya. Berjalan di browser Anda.',
    placeholder: 'Cari — mis. em dash, derajat, euro, panah, pi',
    copied: 'Disalin', empty: 'Tidak ada karakter yang cocok.',
    hint: 'Tip: cari berdasarkan nama atau kata kunci. Klik karakter untuk menyalin ke clipboard.',
  },
};

export default function EmojiPicker({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');

  const results = useMemo(() => searchGlyphs(query), [query]);

  // With no query, group into sections; with a query, show a flat ranked list.
  const grouped = useMemo(() => {
    if (query.trim()) return null;
    const map = new Map<string, Glyph[]>();
    for (const g of results) {
      if (!map.has(g.group)) map.set(g.group, []);
      map.get(g.group)!.push(g);
    }
    return GLYPH_GROUPS.filter(gr => map.has(gr)).map(gr => ({ group: gr, items: map.get(gr)! }));
  }, [results, query]);

  const copy = async (g: Glyph) => {
    try {
      await navigator.clipboard.writeText(g.char);
      setCopied(`${t.copied} ${g.char}  ·  ${g.name}`);
      setTimeout(() => setCopied(''), 1500);
    } catch { /* clipboard blocked */ }
  };

  const Cell = (g: Glyph, key: string | number) => (
    <button
      key={key}
      type="button"
      onClick={() => copy(g)}
      title={`${g.name} — ${t.copied.toLowerCase()}`}
      className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/40 text-2xl transition-colors hover:border-accent hover:bg-muted"
    >
      {g.char}
    </button>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="sticky top-2 z-10 flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t.placeholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {copied && <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{copied}</span>}
      </div>

      {results.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : grouped ? (
        <div className="space-y-4">
          {grouped.map(sec => (
            <div key={sec.group} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sec.group}</h3>
              <div className="flex flex-wrap gap-1.5">{sec.items.map((g, i) => Cell(g, i))}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">{results.map((g, i) => Cell(g, i))}</div>
      )}

      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
