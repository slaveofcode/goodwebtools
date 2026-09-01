import { useMemo, useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { DownloadTextButton } from '@/components/ui/DownloadTextButton';
import { sortTextLines, type SortLinesOptions } from '@/tools/dev/sort-lines.lib';
import type { Lang } from '@/i18n/config';

type Dir = 'asc' | 'desc' | 'reverse';

const TR: Record<Lang, {
  intro: string; input: string; output: string; placeholder: string; direction: string;
  asc: string; desc: string; reverse: string; options: string;
  caseInsensitive: string; natural: string; byKey: string; dedupe: string; trimEach: string; dropBlanks: string;
  trimChars: string; trimCharsPh: string; count: (n: number) => string;
}> = {
  en: {
    intro: 'Reorder lines of text — ascending, descending or reversed — with options for case, natural (numeric) order, and sorting by the key before = or : (handy for env vars and k8s/Vault secrets). Everything runs in your browser; nothing is uploaded.',
    input: 'Lines', output: 'Sorted', placeholder: 'Paste lines to sort…\nAPI_KEY=1\nDB_HOST=localhost',
    direction: 'Order', asc: 'A → Z', desc: 'Z → A', reverse: 'Reverse (no sort)',
    options: 'Options',
    caseInsensitive: 'Ignore case', natural: 'Natural order (2 before 10)',
    byKey: 'Sort by key (before = or :)', dedupe: 'Remove duplicate lines',
    trimEach: 'Trim each line', dropBlanks: 'Remove blank lines',
    trimChars: 'Trim characters', trimCharsPh: 'e.g. "\',',
    count: (n) => `${n} line${n === 1 ? '' : 's'}`,
  },
  id: {
    intro: 'Urutkan baris teks — menaik, menurun, atau dibalik — dengan opsi case, urutan natural (angka), dan urutkan berdasarkan key sebelum = atau : (berguna untuk env var dan secret k8s/Vault). Semua berjalan di browser Anda; tidak ada yang diunggah.',
    input: 'Baris', output: 'Terurut', placeholder: 'Tempel baris untuk diurutkan…\nAPI_KEY=1\nDB_HOST=localhost',
    direction: 'Urutan', asc: 'A → Z', desc: 'Z → A', reverse: 'Balik (tanpa urut)',
    options: 'Opsi',
    caseInsensitive: 'Abaikan huruf besar/kecil', natural: 'Urutan natural (2 sebelum 10)',
    byKey: 'Urutkan berdasarkan key (sebelum = atau :)', dedupe: 'Hapus baris duplikat',
    trimEach: 'Rapikan tiap baris', dropBlanks: 'Hapus baris kosong',
    trimChars: 'Pangkas karakter', trimCharsPh: 'mis. "\',',
    count: (n) => `${n} baris`,
  },
};

export default function SortLines({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('');
  const [direction, setDirection] = useState<Dir>('asc');
  const [flags, setFlags] = useState<Omit<SortLinesOptions, 'direction' | 'trimChars'>>({});
  const [trimChars, setTrimChars] = useState('');

  const output = useMemo(
    () => sortTextLines(text, { ...flags, direction, trimChars }),
    [text, flags, direction, trimChars],
  );
  const outCount = output === '' ? 0 : output.split('\n').length;

  const toggle = (key: keyof typeof flags) => setFlags(p => ({ ...p, [key]: !p[key] }));

  const CHECKS: { key: keyof typeof flags; label: string }[] = [
    { key: 'caseInsensitive', label: t.caseInsensitive },
    { key: 'natural', label: t.natural },
    { key: 'byKey', label: t.byKey },
    { key: 'dedupe', label: t.dedupe },
    { key: 'trimEach', label: t.trimEach },
    { key: 'dropBlanks', label: t.dropBlanks },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{t.direction}</span>
          <select
            value={direction}
            onChange={e => setDirection(e.target.value as Dir)}
            className="h-9 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm"
          >
            <option value="asc">{t.asc}</option>
            <option value="desc">{t.desc}</option>
            <option value="reverse">{t.reverse}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{t.trimChars}</span>
          <input
            value={trimChars}
            onChange={e => setTrimChars(e.target.value)}
            placeholder={t.trimCharsPh}
            className="h-9 w-40 border-2 border-border bg-muted px-2 font-mono outline-none focus:shadow-brutal-sm"
          />
        </label>
      </div>

      <div className="space-y-1">
        <span className="block text-sm font-semibold">{t.options}</span>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {CHECKS.map(c => (
            <label key={c.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!flags[c.key]} onChange={() => toggle(c.key)} className="h-4 w-4 accent-accent" />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <span className="block text-sm font-semibold">{t.input}</span>
          <TextArea value={text} onChange={e => setText(e.target.value)} rows={14} placeholder={t.placeholder} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t.output} <span className="font-normal text-muted-foreground">· {t.count(outCount)}</span></span>
            <div className="flex gap-2">
              <DownloadTextButton text={output} filename="sorted.txt" />
              <CopyButton value={output} />
            </div>
          </div>
          <TextArea value={output} readOnly rows={14} />
        </div>
      </div>
    </div>
  );
}
