import { useState, useMemo, useRef } from 'react';
import { CalendarClock, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import {
  parseCron, explainCron, nextRuns,
  FIELD_LABELS, CRON_PRESETS,
} from '@/tools/dev/cron.lib';
import { naturalToCron, NATURAL_EXAMPLES } from '@/tools/dev/cron-natural.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  exprLabel: string;
  description: string;
  nextRuns: string;
  presets: string;
  invalidExpr: string;
  noRuns: string;
  describeLabel: string;
  describePlaceholder: string;
  convertBtn: string;
  convertError: string;
  dividerOr: string;
}> = {
  en: {
    exprLabel: 'Cron expression',
    description: 'Description',
    nextRuns: 'Next 10 run times',
    presets: 'Presets',
    invalidExpr: 'Invalid expression',
    noRuns: 'No scheduled runs found in the next 4 years.',
    describeLabel: 'Describe your schedule',
    describePlaceholder: 'e.g. every weekday at 9am, every 15 minutes, midnight on the 1st…',
    convertBtn: 'Convert to cron',
    convertError: 'Could not parse — try "every 15 minutes", "weekdays at 9am", "1st of every month"',
    dividerOr: 'or type a cron expression directly',
  },
  id: {
    exprLabel: 'Ekspresi cron',
    description: 'Deskripsi',
    nextRuns: '10 waktu eksekusi berikutnya',
    presets: 'Preset',
    invalidExpr: 'Ekspresi tidak valid',
    noRuns: 'Tidak ada jadwal yang ditemukan dalam 4 tahun ke depan.',
    describeLabel: 'Deskripsikan jadwal Anda',
    describePlaceholder: 'cth. setiap hari kerja pukul 9 pagi, setiap 15 menit, tengah malam tanggal 1…',
    convertBtn: 'Konversi ke cron',
    convertError: 'Tidak dapat diurai — coba "every 15 minutes", "weekdays at 9am", "1st of every month"',
    dividerOr: 'atau ketik ekspresi cron secara langsung',
  },
};

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short',
    day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function CronExplainer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [expr, setExpr] = useState('* * * * *');
  const [nlInput, setNlInput] = useState('');
  const [nlError, setNlError] = useState('');
  const exprRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseCron(expr), [expr]);
  const explanation = useMemo(() => {
    if (!parsed.ok) return null;
    return explainCron(parsed.cron);
  }, [parsed]);
  const runs = useMemo(() => {
    if (!parsed.ok) return [];
    return nextRuns(parsed.cron, new Date(), 10);
  }, [parsed]);

  const parts = expr.trim().split(/\s+/);
  const fieldParts = parts.length === 5 ? parts : ['*', '*', '*', '*', '*'];

  const handleConvert = () => {
    setNlError('');
    const result = naturalToCron(nlInput);
    if (result.ok) {
      setExpr(result.expr);
      exprRef.current?.focus();
    } else {
      setNlError(result.error);
    }
  };

  // Cycle through example hints on placeholder click (accessibility: shows examples)
  const exampleHint = NATURAL_EXAMPLES[Math.floor((Date.now() / 4000)) % NATURAL_EXAMPLES.length];

  return (
    <div className="space-y-4">
      {/* Reverse: natural language → cron */}
      <div className="space-y-2">
        <label className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.describeLabel}
        </label>
        <div className="flex gap-2">
          <input
            value={nlInput}
            onChange={e => { setNlInput(e.target.value); setNlError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleConvert(); }}
            placeholder={t.describePlaceholder}
            className="flex-1 border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
            aria-label={t.describeLabel}
          />
          <Button variant="primary" onClick={handleConvert} disabled={!nlInput.trim()}>
            <ArrowDown className="h-4 w-4" />
            {t.convertBtn}
          </Button>
        </div>
        {nlError && <Alert variant="error">{nlError}</Alert>}
        <p className="text-xs text-muted-foreground">e.g. {exampleHint}</p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>{t.dividerOr}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Main expression input */}
      <div className="space-y-2">
        <label className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.exprLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={exprRef}
            value={expr}
            onChange={e => setExpr(e.target.value)}
            spellCheck={false}
            className="flex-1 border-2 border-border bg-background px-3 py-2 font-mono text-xl outline-none focus:shadow-brutal-sm"
            placeholder="* * * * *"
            aria-label={t.exprLabel}
          />
          <CopyButton value={expr} />
        </div>

        {/* Field labels */}
        <div className="grid grid-cols-5 gap-1 pt-1">
          {FIELD_LABELS.map((f, i) => (
            <div key={f.key} className="text-center">
              <div className={`border-2 py-1 px-1 font-mono text-sm font-bold ${
                parsed.ok ? 'border-border bg-muted' : 'border-red-400 bg-red-50 dark:bg-red-950/30'
              }`}>
                {fieldParts[i] ?? '*'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground leading-tight">{f.label}</div>
              <div className="text-xs text-muted-foreground/60">{f.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {!parsed.ok && (
        <Alert variant="error">{t.invalidExpr}: {parsed.error}</Alert>
      )}

      {/* Description */}
      {explanation && (
        <div className="border-2 border-border bg-muted p-3">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.description}</div>
          <p className="text-lg font-semibold">{explanation}</p>
        </div>
      )}

      {/* Presets */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.presets}</div>
        <div className="flex flex-wrap gap-2">
          {CRON_PRESETS.map(p => (
            <Button
              key={p.expr}
              variant={expr === p.expr ? 'primary' : 'secondary'}
              onClick={() => setExpr(p.expr)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Next runs */}
      {parsed.ok && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" />
            {t.nextRuns}
          </div>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noRuns}</p>
          ) : (
            <ol className="space-y-1">
              {runs.map((d, i) => (
                <li key={i} className="flex items-center gap-3 border-2 border-border bg-muted px-3 py-1.5">
                  <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                  <code className="flex-1 font-mono text-sm">{formatDate(d)}</code>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
