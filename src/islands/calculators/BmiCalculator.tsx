import { useState } from 'react';
import { computeBmi, bmiCategory, healthyWeightRange, lbToKg, ftInToCm } from '@/tools/calculators/bmi.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Work out your Body Mass Index from your height and weight. Everything is calculated in your browser — nothing is sent anywhere.',
    metric: 'Metric', imperial: 'Imperial', height: 'Height', weight: 'Weight',
    cm: 'cm', kg: 'kg', ft: 'ft', in: 'in', lb: 'lb',
    result: 'Your BMI', healthy: 'Healthy weight for your height',
    underweight: 'Underweight', normal: 'Normal', overweight: 'Overweight', obese: 'Obese',
  },
  id: {
    intro: 'Hitung Indeks Massa Tubuh (BMI) dari tinggi dan berat badan Anda. Semua dihitung di browser Anda — tidak ada yang dikirim ke mana pun.',
    metric: 'Metrik', imperial: 'Imperial', height: 'Tinggi', weight: 'Berat',
    cm: 'cm', kg: 'kg', ft: 'ft', in: 'in', lb: 'lb',
    result: 'BMI Anda', healthy: 'Berat sehat untuk tinggi Anda',
    underweight: 'Kurus', normal: 'Normal', overweight: 'Berlebih', obese: 'Obesitas',
  },
};

const CAT_COLOR: Record<string, string> = {
  underweight: 'bg-sky-200 dark:bg-sky-900/40',
  normal: 'bg-lime-200 dark:bg-lime-900/40',
  overweight: 'bg-amber-200 dark:bg-amber-900/40',
  obese: 'bg-rose-200 dark:bg-rose-900/40',
};

export default function BmiCalculator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [cm, setCm] = useState('175');
  const [kg, setKg] = useState('70');
  const [ft, setFt] = useState('5');
  const [inch, setInch] = useState('9');
  const [lb, setLb] = useState('154');

  const heightCm = unit === 'metric' ? Number(cm) || 0 : ftInToCm(Number(ft) || 0, Number(inch) || 0);
  const weightKg = unit === 'metric' ? Number(kg) || 0 : lbToKg(Number(lb) || 0);
  const bmi = computeBmi(weightKg, heightCm);
  const cat = bmiCategory(bmi);
  const range = healthyWeightRange(heightCm);
  const input = 'w-full border-2 border-border bg-muted p-2 text-sm tabular-nums';

  const kgToUnit = (v: number) => unit === 'metric' ? `${v.toFixed(1)} ${t.kg}` : `${(v / 0.45359237).toFixed(0)} ${t.lb}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex gap-1">
        {(['metric', 'imperial'] as const).map(u => (
          <button key={u} onClick={() => setUnit(u)} aria-pressed={unit === u}
            className={`border-2 px-4 py-1.5 text-sm font-bold uppercase tracking-wide ${unit === u ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border'}`}>
            {t[u]}
          </button>
        ))}
      </div>

      {unit === 'metric' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.height} ({t.cm})</span>
            <input value={cm} onChange={e => setCm(e.target.value)} inputMode="decimal" className={input} /></label>
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.weight} ({t.kg})</span>
            <input value={kg} onChange={e => setKg(e.target.value)} inputMode="decimal" className={input} /></label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.height} ({t.ft})</span>
            <input value={ft} onChange={e => setFt(e.target.value)} inputMode="numeric" className={input} /></label>
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.height} ({t.in})</span>
            <input value={inch} onChange={e => setInch(e.target.value)} inputMode="numeric" className={input} /></label>
          <label className="space-y-1 text-sm"><span className="block font-semibold">{t.weight} ({t.lb})</span>
            <input value={lb} onChange={e => setLb(e.target.value)} inputMode="decimal" className={input} /></label>
        </div>
      )}

      {bmi > 0 && (
        <div className={`border-2 border-border p-4 text-black shadow-brutal dark:text-white ${CAT_COLOR[cat]}`}>
          <div className="text-xs font-bold uppercase tracking-wide">{t.result}</div>
          <div className="text-4xl font-black tabular-nums">{bmi.toFixed(1)}</div>
          <div className="mt-1 font-bold uppercase">{t[cat]}</div>
          <div className="mt-2 text-xs opacity-80">{t.healthy}: {kgToUnit(range.min)} – {kgToUnit(range.max)}</div>
        </div>
      )}
    </div>
  );
}
