import { useMemo, useState } from 'react';
import { usePrefill } from '@/hooks/usePrefill';
import { Button } from '@/components/ui/Button';
import { UNIT_CATEGORIES, getCategory, convert, formatNumber } from '@/tools/calculators/units.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; category: string; from: string; to: string; swap: string; value: string; result: string }> = {
  en: {
    intro: 'Convert between units of length, mass, temperature, area, volume, speed, time and digital storage. Type a value and read the result instantly — everything is computed in your browser.',
    category: 'Category', from: 'From', to: 'To', swap: 'Swap', value: 'Value', result: 'Result',
  },
  id: {
    intro: 'Konversi antar satuan panjang, massa, suhu, luas, volume, kecepatan, waktu, dan penyimpanan digital. Ketik nilai dan lihat hasilnya seketika — semua dihitung di browser Anda.',
    category: 'Kategori', from: 'Dari', to: 'Ke', swap: 'Tukar', value: 'Nilai', result: 'Hasil',
  },
};

export default function UnitConverter({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const l: Lang = lang === 'id' ? 'id' : 'en';
  const [catId, setCatId] = useState(UNIT_CATEGORIES[0].id);
  const [fromId, setFromId] = useState(UNIT_CATEGORIES[0].units[0].id);
  const [toId, setToId] = useState(UNIT_CATEGORIES[0].units[1].id);
  const prefill = usePrefill();
  const [value, setValue] = useState(prefill.number !== undefined ? String(prefill.number) : '1');

  const cat = getCategory(catId)!;

  const output = useMemo(() => {
    const v = Number(value);
    if (value.trim() === '' || !Number.isFinite(v)) return '';
    try {
      return formatNumber(convert(catId, v, fromId, toId));
    } catch {
      return '';
    }
  }, [catId, value, fromId, toId]);

  const pickCategory = (id: string) => {
    const c = getCategory(id)!;
    setCatId(id);
    setFromId(c.units[0].id);
    setToId(c.units[1]?.id ?? c.units[0].id);
  };

  const swap = () => {
    setFromId(toId);
    setToId(fromId);
    if (output !== '') setValue(output);
  };

  const unitOptions = cat.units.map(u => (
    <option key={u.id} value={u.id}>{u.label[l]} ({u.symbol})</option>
  ));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="space-y-1.5">
        <span className="block text-sm font-semibold">{t.category}</span>
        <div className="flex flex-wrap gap-2">
          {UNIT_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => pickCategory(c.id)} aria-pressed={catId === c.id}
              className={`border-2 px-3 py-1 text-sm font-medium transition-all ${catId === c.id ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'}`}>
              {c.label[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-1 text-sm">
          <span className="block font-semibold">{t.from}</span>
          <input type="number" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)}
            aria-label={t.value}
            className="w-full border-2 border-border bg-muted p-2 text-sm tabular-nums" />
          <select value={fromId} onChange={e => setFromId(e.target.value)}
            className="w-full border-2 border-border bg-background p-2 text-sm">{unitOptions}</select>
        </div>

        <div className="flex justify-center pb-2 sm:pb-8">
          <Button variant="secondary" onClick={swap} className="text-xs" aria-label={t.swap}>⇄ {t.swap}</Button>
        </div>

        <div className="space-y-1 text-sm">
          <span className="block font-semibold">{t.to}</span>
          <output aria-label={t.result}
            className="block w-full break-words border-2 border-border bg-accent p-2 text-sm font-bold tabular-nums text-accent-foreground min-h-[2.5rem]">
            {output || '—'}
          </output>
          <select value={toId} onChange={e => setToId(e.target.value)}
            className="w-full border-2 border-border bg-background p-2 text-sm">{unitOptions}</select>
        </div>
      </div>
    </div>
  );
}
