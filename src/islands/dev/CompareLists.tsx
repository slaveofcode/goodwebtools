import { useMemo, useState } from 'react';
import { ArrowLeftRight, Download } from 'lucide-react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download.service';
import { compareLines, type LineSetMode, type LineSetOptions } from '@/tools/dev/lineset.lib';
import type { Lang } from '@/i18n/config';

const MODE_IDS: LineSetMode[] = ['union', 'difference', 'differenceB', 'intersection', 'symmetric', 'duplicates'];

const TR: Record<Lang, {
  intro: string; listA: string; listB: string; placeholderA: string; placeholderB: string;
  swap: string; result: string; resultCount: (n: number) => string; lineCount: (n: number) => string;
  download: string; empty: string; optionsLabel: string;
  opts: Record<keyof LineSetOptions, string>;
  modes: Record<LineSetMode, { label: string; hint: string }>;
}> = {
  en: {
    intro: 'Compare two lists of lines and combine them with set operations — merge and dedupe, subtract one from the other, find what they share, and more. Everything runs in your browser; nothing is uploaded.',
    listA: 'List A', listB: 'List B',
    placeholderA: 'Paste the first list, one item per line…', placeholderB: 'Paste the second list, one item per line…',
    swap: 'Swap A ↔ B', result: 'Result', resultCount: (n) => `${n.toLocaleString()} line${n === 1 ? '' : 's'}`,
    lineCount: (n) => `${n.toLocaleString()} line${n === 1 ? '' : 's'}`, download: 'Download .txt',
    empty: 'The result is empty.', optionsLabel: 'Options',
    opts: { caseInsensitive: 'Ignore case', trim: 'Trim whitespace', ignoreBlank: 'Ignore blank lines', sort: 'Sort result' },
    modes: {
      union: { label: 'Merge & dedupe', hint: 'All unique lines from both lists (A ∪ B)' },
      difference: { label: 'In A, not in B', hint: 'Remove B’s lines from A (A − B)' },
      differenceB: { label: 'In B, not in A', hint: 'Remove A’s lines from B (B − A)' },
      intersection: { label: 'Common to both', hint: 'Lines that appear in both lists (A ∩ B)' },
      symmetric: { label: 'In only one', hint: 'Lines in just one of the lists (A △ B)' },
      duplicates: { label: 'Duplicates', hint: 'Lines that appear 2+ times across both lists' },
    },
  },
  id: {
    intro: 'Bandingkan dua daftar baris dan gabungkan dengan operasi himpunan — gabung dan hapus duplikat, kurangi satu dari yang lain, temukan yang sama, dan lainnya. Semuanya berjalan di browser Anda; tidak ada yang diunggah.',
    listA: 'Daftar A', listB: 'Daftar B',
    placeholderA: 'Tempel daftar pertama, satu item per baris…', placeholderB: 'Tempel daftar kedua, satu item per baris…',
    swap: 'Tukar A ↔ B', result: 'Hasil', resultCount: (n) => `${n.toLocaleString()} baris`,
    lineCount: (n) => `${n.toLocaleString()} baris`, download: 'Unduh .txt',
    empty: 'Hasilnya kosong.', optionsLabel: 'Opsi',
    opts: { caseInsensitive: 'Abaikan huruf besar/kecil', trim: 'Pangkas spasi', ignoreBlank: 'Abaikan baris kosong', sort: 'Urutkan hasil' },
    modes: {
      union: { label: 'Gabung & hapus duplikat', hint: 'Semua baris unik dari kedua daftar (A ∪ B)' },
      difference: { label: 'Di A, tidak di B', hint: 'Hapus baris B dari A (A − B)' },
      differenceB: { label: 'Di B, tidak di A', hint: 'Hapus baris A dari B (B − A)' },
      intersection: { label: 'Sama di keduanya', hint: 'Baris yang muncul di kedua daftar (A ∩ B)' },
      symmetric: { label: 'Hanya di salah satu', hint: 'Baris yang hanya ada di salah satu daftar (A △ B)' },
      duplicates: { label: 'Duplikat', hint: 'Baris yang muncul 2+ kali di kedua daftar' },
    },
  },
};

const nonEmptyLines = (s: string) => (s.length ? s.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '').length : 0);

export default function CompareLists({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [mode, setMode] = useState<LineSetMode>('union');
  const [opts, setOpts] = useState<LineSetOptions>({ trim: true });

  const result = useMemo(() => compareLines(a, b, mode, opts), [a, b, mode, opts]);
  const resultText = useMemo(() => result.lines.join('\n'), [result]);

  const toggle = (k: keyof LineSetOptions) => setOpts((o) => ({ ...o, [k]: !o[k] }));
  const swap = () => { setA(b); setB(a); };
  const download = () => downloadService.download(new Blob([resultText], { type: 'text/plain' }), 'compare-result.txt');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <TextArea label={`${t.listA} · ${t.lineCount(nonEmptyLines(a))}`} value={a} onChange={(e) => setA(e.target.value)} placeholder={t.placeholderA} rows={10} spellCheck={false} />
        </div>
        <div className="space-y-1">
          <TextArea label={`${t.listB} · ${t.lineCount(nonEmptyLines(b))}`} value={b} onChange={(e) => setB(e.target.value)} placeholder={t.placeholderB} rows={10} spellCheck={false} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={swap}><ArrowLeftRight className="h-4 w-4" /> {t.swap}</Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {MODE_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              title={t.modes[id].hint}
              aria-pressed={mode === id}
              className={`border-2 px-3 py-1.5 text-sm font-medium transition-all ${mode === id ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'}`}
            >
              {t.modes[id].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t.modes[mode].hint}</p>
      </div>

      <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className="mb-1 text-sm font-semibold">{t.optionsLabel}</legend>
        {(Object.keys(t.opts) as (keyof LineSetOptions)[]).map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={!!opts[k]} onChange={() => toggle(k)} className="h-4 w-4 accent-accent" />
            {t.opts[k]}
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-semibold">{t.result} · {t.resultCount(result.count)}</span>
          <CopyButton value={resultText} />
          <Button variant="secondary" onClick={download} disabled={result.count === 0}><Download className="h-4 w-4" /> {t.download}</Button>
        </div>
        <TextArea value={resultText} readOnly rows={10} spellCheck={false} placeholder={t.empty} />
      </div>
    </div>
  );
}
