import { useState } from 'react';
import { usePrefill } from '@/hooks/usePrefill';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { toRoman, fromRoman } from '@/tools/calculators/roman.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; toRoman: string; toNumber: string; swap: string; result: string; numberPh: string; romanPh: string; error: string }> = {
  en: {
    intro: 'Convert numbers to Roman numerals and back — for dates, tattoos, clocks and movie credits. Works for 1 to 3999. Runs in your browser.',
    toRoman: 'Number → Roman', toNumber: 'Roman → Number', swap: 'Swap', result: 'Result',
    numberPh: 'e.g. 2026', romanPh: 'e.g. MMXXVI', error: 'Invalid input.',
  },
  id: {
    intro: 'Konversi angka ke angka Romawi dan sebaliknya — untuk tanggal, tato, jam, dan kredit film. Berlaku untuk 1 sampai 3999. Berjalan di browser Anda.',
    toRoman: 'Angka → Romawi', toNumber: 'Romawi → Angka', swap: 'Tukar', result: 'Hasil',
    numberPh: 'mis. 2026', romanPh: 'mis. MMXXVI', error: 'Input tidak valid.',
  },
};

export default function RomanNumeral({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const prefill = usePrefill();
  const [mode, setMode] = useState<'toRoman' | 'toNumber'>('toRoman');
  const [value, setValue] = useState(prefill.number !== undefined ? String(prefill.number) : '');

  let result = '';
  let error = '';
  if (value.trim()) {
    try {
      result = mode === 'toRoman' ? toRoman(Number(value)) : String(fromRoman(value));
    } catch (e) {
      error = e instanceof Error ? e.message : t.error;
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={mode === 'toRoman' ? 'primary' : 'secondary'} onClick={() => { setMode('toRoman'); setValue(''); }}>{t.toRoman}</Button>
        <Button variant={mode === 'toNumber' ? 'primary' : 'secondary'} onClick={() => { setMode('toNumber'); setValue(''); }}>{t.toNumber}</Button>
        <Button variant="ghost" onClick={() => { setMode(m => m === 'toRoman' ? 'toNumber' : 'toRoman'); setValue(result && !error ? result : ''); }}>
          <ArrowRightLeft className="h-4 w-4" /> {t.swap}
        </Button>
      </div>

      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        inputMode={mode === 'toRoman' ? 'numeric' : 'text'}
        placeholder={mode === 'toRoman' ? t.numberPh : t.romanPh}
        className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-lg outline-none focus:border-accent"
      />

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t.result}</span>
          {result && !error && <CopyButton value={result} />}
        </div>
        <div className="min-h-[3rem] break-all rounded-lg border border-border bg-muted/40 px-3 py-2 text-2xl font-bold tracking-wide">
          {error ? <span className="text-base font-normal text-red-600 dark:text-red-400">{error}</span> : (result || <span className="text-base font-normal text-muted-foreground">—</span>)}
        </div>
      </div>
    </div>
  );
}
