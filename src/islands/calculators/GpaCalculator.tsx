import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { computeGpa, GRADE_POINTS, type Course } from '@/tools/calculators/gpa.lib';
import type { Lang } from '@/i18n/config';

interface Row extends Course { id: number; name: string }

const GRADES = Object.keys(GRADE_POINTS);

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Add your courses with a letter grade and credit hours to get your weighted GPA on a 4.0 scale. Calculated in your browser.',
    course: 'Course (optional)', grade: 'Grade', credits: 'Credits', add: 'Add course',
    gpa: 'Your GPA', totalCredits: 'Total credits', coursePh: 'e.g. Calculus',
  },
  id: {
    intro: 'Tambahkan mata kuliah dengan nilai huruf dan jumlah SKS untuk mendapatkan IPK terbobot pada skala 4,0. Dihitung di browser Anda.',
    course: 'Mata kuliah (opsional)', grade: 'Nilai', credits: 'SKS', add: 'Tambah mata kuliah',
    gpa: 'IPK Anda', totalCredits: 'Total SKS', coursePh: 'mis. Kalkulus',
  },
};

export default function GpaCalculator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [rows, setRows] = useState<Row[]>([
    { id: 1, name: '', grade: 'A', credits: 3 },
    { id: 2, name: '', grade: 'B+', credits: 4 },
  ]);
  const nextId = useRef(3);

  const update = (id: number, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows(rs => [...rs, { id: nextId.current++, name: '', grade: 'A', credits: 3 }]);
  const removeRow = (id: number) => setRows(rs => rs.filter(r => r.id !== id));

  const { gpa, credits } = computeGpa(rows);
  const input = 'border-2 border-border bg-muted p-2 text-sm tabular-nums';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="space-y-2">
        <div className="hidden gap-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1fr_120px_100px_40px]">
          <span>{t.course}</span><span>{t.grade}</span><span>{t.credits}</span><span />
        </div>
        {rows.map(r => (
          <div key={r.id} className="grid grid-cols-[1fr_90px_70px_40px] gap-2 sm:grid-cols-[1fr_120px_100px_40px]">
            <input value={r.name} onChange={e => update(r.id, { name: e.target.value })} placeholder={t.coursePh} className={input} />
            <select value={r.grade} onChange={e => update(r.id, { grade: e.target.value })} className={input}>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input value={String(r.credits)} onChange={e => update(r.id, { credits: Number(e.target.value) || 0 })} inputMode="decimal" className={input} />
            <button onClick={() => removeRow(r.id)} aria-label="remove" className="flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button variant="secondary" onClick={addRow}><Plus className="h-4 w-4" />{t.add}</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-2 border-border bg-lime-200 p-4 text-black shadow-brutal dark:bg-lime-900/40 dark:text-white">
          <div className="text-xs font-bold uppercase tracking-wide">{t.gpa}</div>
          <div className="text-4xl font-black tabular-nums">{gpa.toFixed(2)}</div>
        </div>
        <div className="border-2 border-border bg-muted p-4 shadow-brutal">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.totalCredits}</div>
          <div className="text-4xl font-black tabular-nums">{credits}</div>
        </div>
      </div>
    </div>
  );
}
