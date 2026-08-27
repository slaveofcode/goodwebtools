import { useState } from 'react';
import { bmr, tdee, calorieGoals, ACTIVITY_FACTORS, type Sex, type Activity } from '@/tools/calculators/tdee.lib';
import { lbToKg, ftInToCm } from '@/tools/calculators/bmi.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Estimate your daily calorie needs (BMR and TDEE) with the Mifflin-St Jeor formula. Calculated entirely in your browser.',
    metric: 'Metric', imperial: 'Imperial', sex: 'Sex', male: 'Male', female: 'Female',
    age: 'Age', height: 'Height', weight: 'Weight', activity: 'Activity level',
    bmr: 'BMR (at rest)', tdee: 'TDEE (maintenance)', perDay: 'kcal / day',
    goals: 'Daily calories by goal', loseFast: 'Lose (−0.5 kg/wk)', lose: 'Lose (−0.25 kg/wk)',
    maintain: 'Maintain', gain: 'Gain (+0.25 kg/wk)', gainFast: 'Gain (+0.5 kg/wk)',
    sedentary: 'Sedentary (little/no exercise)', light: 'Light (1–3 days/wk)', moderate: 'Moderate (3–5 days/wk)',
    active: 'Active (6–7 days/wk)', veryActive: 'Very active (hard daily / physical job)',
  },
  id: {
    intro: 'Perkirakan kebutuhan kalori harian Anda (BMR dan TDEE) dengan rumus Mifflin-St Jeor. Dihitung sepenuhnya di browser Anda.',
    metric: 'Metrik', imperial: 'Imperial', sex: 'Jenis kelamin', male: 'Pria', female: 'Wanita',
    age: 'Usia', height: 'Tinggi', weight: 'Berat', activity: 'Tingkat aktivitas',
    bmr: 'BMR (istirahat)', tdee: 'TDEE (pemeliharaan)', perDay: 'kkal / hari',
    goals: 'Kalori harian per tujuan', loseFast: 'Turun (−0,5 kg/mgg)', lose: 'Turun (−0,25 kg/mgg)',
    maintain: 'Pertahankan', gain: 'Naik (+0,25 kg/mgg)', gainFast: 'Naik (+0,5 kg/mgg)',
    sedentary: 'Rendah (sedikit/tanpa olahraga)', light: 'Ringan (1–3 hari/mgg)', moderate: 'Sedang (3–5 hari/mgg)',
    active: 'Aktif (6–7 hari/mgg)', veryActive: 'Sangat aktif (berat harian / kerja fisik)',
  },
};

export default function TdeeCalculator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('30');
  const [cm, setCm] = useState('175');
  const [kg, setKg] = useState('70');
  const [ft, setFt] = useState('5');
  const [inch, setInch] = useState('9');
  const [lb, setLb] = useState('154');
  const [activity, setActivity] = useState<Activity>('moderate');

  const heightCm = unit === 'metric' ? Number(cm) || 0 : ftInToCm(Number(ft) || 0, Number(inch) || 0);
  const weightKg = unit === 'metric' ? Number(kg) || 0 : lbToKg(Number(lb) || 0);
  const ageN = Number(age) || 0;
  const valid = heightCm > 0 && weightKg > 0 && ageN > 0;
  const bmrVal = bmr(sex, weightKg, heightCm, ageN);
  const tdeeVal = tdee(sex, weightKg, heightCm, ageN, activity);
  const goals = calorieGoals(tdeeVal);
  const input = 'w-full border-2 border-border bg-muted p-2 text-sm tabular-nums';
  const kcal = (v: number) => Math.round(v).toLocaleString();

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.sex}</span>
          <select value={sex} onChange={e => setSex(e.target.value as Sex)} className={input}>
            <option value="male">{t.male}</option><option value="female">{t.female}</option>
          </select></label>
        <label className="space-y-1 text-sm"><span className="block font-semibold">{t.age}</span>
          <input value={age} onChange={e => setAge(e.target.value)} inputMode="numeric" className={input} /></label>
        {unit === 'metric' ? (
          <>
            <label className="space-y-1 text-sm"><span className="block font-semibold">{t.height} (cm)</span>
              <input value={cm} onChange={e => setCm(e.target.value)} inputMode="decimal" className={input} /></label>
            <label className="space-y-1 text-sm"><span className="block font-semibold">{t.weight} (kg)</span>
              <input value={kg} onChange={e => setKg(e.target.value)} inputMode="decimal" className={input} /></label>
          </>
        ) : (
          <>
            <label className="space-y-1 text-sm"><span className="block font-semibold">{t.height} (ft/in)</span>
              <span className="flex gap-1">
                <input value={ft} onChange={e => setFt(e.target.value)} inputMode="numeric" className={input} />
                <input value={inch} onChange={e => setInch(e.target.value)} inputMode="numeric" className={input} />
              </span></label>
            <label className="space-y-1 text-sm"><span className="block font-semibold">{t.weight} (lb)</span>
              <input value={lb} onChange={e => setLb(e.target.value)} inputMode="decimal" className={input} /></label>
          </>
        )}
      </div>

      <label className="block space-y-1 text-sm"><span className="block font-semibold">{t.activity}</span>
        <select value={activity} onChange={e => setActivity(e.target.value as Activity)} className={input}>
          {(Object.keys(ACTIVITY_FACTORS) as Activity[]).map(a => <option key={a} value={a}>{t[a]}</option>)}
        </select></label>

      {valid && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-2 border-border bg-muted p-4 shadow-brutal">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.bmr}</div>
              <div className="text-3xl font-black tabular-nums">{kcal(bmrVal)}</div>
              <div className="text-xs text-muted-foreground">{t.perDay}</div>
            </div>
            <div className="border-2 border-border bg-lime-200 p-4 text-black shadow-brutal dark:bg-lime-900/40 dark:text-white">
              <div className="text-xs font-bold uppercase tracking-wide">{t.tdee}</div>
              <div className="text-3xl font-black tabular-nums">{kcal(tdeeVal)}</div>
              <div className="text-xs opacity-80">{t.perDay}</div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.goals}</div>
            <ul className="divide-y-2 divide-border border-2 border-border">
              {(['loseFast', 'lose', 'maintain', 'gain', 'gainFast'] as const).map(k => (
                <li key={k} className="flex justify-between px-3 py-2 text-sm">
                  <span>{t[k]}</span>
                  <span className="font-mono font-bold tabular-nums">{kcal(goals[k])} {t.perDay}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
