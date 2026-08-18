import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { generateLorem, type LoremUnit } from '@/tools/dev/lorem.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; amount: string; unit: string; startWith: string; generate: string; output: string;
  units: Record<LoremUnit, string>;
}> = {
  en: {
    intro: 'Generate placeholder Lorem Ipsum text — by paragraphs, sentences or words — for mockups and layouts. Runs entirely in your browser.',
    amount: 'Amount',
    unit: 'Type',
    startWith: 'Start with "Lorem ipsum…"',
    generate: 'Generate',
    output: 'Result',
    units: { paragraphs: 'Paragraphs', sentences: 'Sentences', words: 'Words' },
  },
  id: {
    intro: 'Buat teks placeholder Lorem Ipsum — per paragraf, kalimat, atau kata — untuk mockup dan tata letak. Berjalan sepenuhnya di browser Anda.',
    amount: 'Jumlah',
    unit: 'Tipe',
    startWith: 'Mulai dengan "Lorem ipsum…"',
    generate: 'Buat',
    output: 'Hasil',
    units: { paragraphs: 'Paragraf', sentences: 'Kalimat', words: 'Kata' },
  },
};

const UNITS: LoremUnit[] = ['paragraphs', 'sentences', 'words'];

export default function LoremIpsum({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [unit, setUnit] = useState<LoremUnit>('paragraphs');
  const [count, setCount] = useState(3);
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [seed, setSeed] = useState(1);
  const [output, setOutput] = useState('');

  const generate = () => {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    const safe = Math.min(Math.max(count, 1), 1000);
    setOutput(generateLorem({ unit, count: safe, startWithLorem, seed: nextSeed }));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t.amount}</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={e => setCount(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t.unit}</span>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value as LoremUnit)}
            className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent"
          >
            {UNITS.map(u => <option key={u} value={u}>{t.units[u]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input type="checkbox" checked={startWithLorem} onChange={e => setStartWithLorem(e.target.checked)} className="h-4 w-4 accent-accent" />
          {t.startWith}
        </label>
        <Button onClick={generate}>{t.generate}</Button>
      </div>

      {output && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t.output}</span>
            <CopyButton value={output} />
          </div>
          <TextArea value={output} readOnly rows={10} monospace={false} />
        </div>
      )}
    </div>
  );
}
