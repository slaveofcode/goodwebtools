import { useState } from 'react';
import { evaluate, type AngleMode } from '@/tools/calculators/scientific.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: { intro: 'A scientific calculator that runs in your browser. Type an expression or tap the keys; supports functions, powers and constants.', error: 'Error', clear: 'C' },
  id: { intro: 'Kalkulator ilmiah yang berjalan di browser Anda. Ketik ekspresi atau ketuk tombol; mendukung fungsi, pangkat, dan konstanta.', error: 'Error', clear: 'C' },
};

/** Round away binary-float noise for display (e.g. 0.1+0.2). */
function formatResult(n: number): string {
  const r = Number(n.toPrecision(12));
  return String(r);
}

// [label, token-to-insert or action]
type Key = { label: string; insert?: string; act?: 'eq' | 'clear' | 'back' };
const KEYS: Key[][] = [
  [{ label: 'sin', insert: 'sin(' }, { label: 'cos', insert: 'cos(' }, { label: 'tan', insert: 'tan(' }, { label: '^', insert: '^' }, { label: '⌫', act: 'back' }],
  [{ label: 'ln', insert: 'ln(' }, { label: 'log', insert: 'log(' }, { label: '√', insert: 'sqrt(' }, { label: '(', insert: '(' }, { label: ')', insert: ')' }],
  [{ label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' }, { label: '÷', insert: '/' }, { label: 'π', insert: 'pi' }],
  [{ label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' }, { label: '×', insert: '*' }, { label: 'e', insert: 'e' }],
  [{ label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' }, { label: '−', insert: '-' }, { label: 'C', act: 'clear' }],
  [{ label: '0', insert: '0' }, { label: '.', insert: '.' }, { label: 'abs', insert: 'abs(' }, { label: '+', insert: '+' }, { label: '=', act: 'eq' }],
];

export default function ScientificCalc({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [angle, setAngle] = useState<AngleMode>('deg');

  const equals = () => {
    if (!expr.trim()) return;
    try { setResult(formatResult(evaluate(expr, angle))); }
    catch { setResult(t.error); }
  };

  const press = (k: Key) => {
    if (k.act === 'eq') return equals();
    if (k.act === 'clear') { setExpr(''); setResult(null); return; }
    if (k.act === 'back') { setExpr(e => e.slice(0, -1)); return; }
    if (k.insert !== undefined) { setExpr(e => e + k.insert); setResult(null); }
  };

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex justify-between">
        <div className="flex gap-1">
          {(['deg', 'rad'] as const).map(a => (
            <button key={a} onClick={() => setAngle(a)} aria-pressed={angle === a}
              className={`border-2 px-3 py-1 text-xs font-bold uppercase tracking-wide ${angle === a ? 'border-border bg-accent text-accent-foreground shadow-brutal-sm' : 'border-border'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="border-2 border-border bg-muted p-3 shadow-brutal">
        <input
          value={expr}
          onChange={e => { setExpr(e.target.value); setResult(null); }}
          onKeyDown={e => { if (e.key === 'Enter') equals(); }}
          placeholder="0"
          aria-label="expression"
          className="w-full bg-transparent text-right font-mono text-xl outline-none"
        />
        <div className="mt-1 text-right font-mono text-3xl font-black tabular-nums text-foreground">
          {result ?? ' '}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {KEYS.flat().map((k, i) => (
          <button
            key={i}
            onClick={() => press(k)}
            className={`border-2 border-border py-3 text-lg font-bold press-brutal ${
              k.act === 'eq' ? 'bg-accent text-accent-foreground shadow-brutal'
              : k.act === 'clear' || k.act === 'back' ? 'bg-rose-200 text-black dark:bg-rose-900/40 dark:text-white'
              : /^[0-9.]$/.test(k.label) ? 'bg-background' : 'bg-muted'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
