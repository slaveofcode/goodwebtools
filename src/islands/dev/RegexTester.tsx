import { useMemo, useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import {
  runRegex,
  highlightHtml,
  codeSnippet,
  flavorWarnings,
  FLAGS,
  LANGUAGES,
  type RegexLang,
} from '@/tools/dev/regex.lib';
import type { Lang } from '@/i18n/config';

const EXAMPLE_PATTERN = '(?<user>[\\w.]+)@(?<domain>[\\w.]+)';
const EXAMPLE_SUBJECT =
  'Contact: alice@example.com, bob@work.co.id\nSupport: team@goodwebtools.com\nInvalid: not-an-email @ nope';

const TR: Record<Lang, {
  intro: string;
  pattern: string;
  flags: string;
  testString: string;
  matchesN: (n: number) => string;
  noMatches: string;
  truncated: string;
  groups: string;
  named: string;
  language: string;
  equivalent: string;
  notes: string;
}> = {
  en: {
    intro: 'Test a regular expression against sample text with live match highlighting, then copy the equivalent code for your language. Everything runs in your browser.',
    pattern: 'Regular expression',
    flags: 'Flags',
    testString: 'Test string',
    matchesN: (n) => `${n} ${n === 1 ? 'match' : 'matches'}`,
    noMatches: 'No matches.',
    truncated: 'Showing the first 10,000 matches.',
    groups: 'Groups',
    named: 'Named',
    language: 'Language',
    equivalent: 'Equivalent code',
    notes: 'Flavor notes',
  },
  id: {
    intro: 'Uji ekspresi reguler terhadap teks contoh dengan sorotan kecocokan langsung, lalu salin kode setara untuk bahasa Anda. Semuanya berjalan di browser Anda.',
    pattern: 'Ekspresi reguler',
    flags: 'Flag',
    testString: 'Teks uji',
    matchesN: (n) => `${n} kecocokan`,
    noMatches: 'Tidak ada kecocokan.',
    truncated: 'Menampilkan 10.000 kecocokan pertama.',
    groups: 'Grup',
    named: 'Bernama',
    language: 'Bahasa',
    equivalent: 'Kode setara',
    notes: 'Catatan flavor',
  },
};

export default function RegexTester({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [pattern, setPattern] = useState(EXAMPLE_PATTERN);
  const [flags, setFlags] = useState('g');
  const [subject, setSubject] = useState(EXAMPLE_SUBJECT);
  const [target, setTarget] = useState<RegexLang>('python');

  const result = useMemo(() => runRegex(pattern, flags, subject), [pattern, flags, subject]);
  const html = useMemo(() => highlightHtml(subject, result.matches), [subject, result]);
  const snippet = useMemo(() => codeSnippet(target, pattern, flags), [target, pattern, flags]);
  const warnings = useMemo(() => flavorWarnings(pattern, flags, target), [pattern, flags, target]);

  const toggleFlag = (f: string) => {
    setFlags(prev =>
      prev.includes(f)
        ? prev.replace(f, '')
        : FLAGS.map(x => x.flag).filter(x => prev.includes(x) || x === f).join(''),
    );
  };

  const chipClass = (active: boolean) =>
    `border-2 px-3 py-1 font-mono text-sm font-medium transition-all ${
      active
        ? 'border-border bg-accent text-accent-foreground shadow-brutal'
        : 'border-border hover:shadow-brutal'
    }`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="space-y-2">
        <span className="block text-sm font-semibold">{t.pattern}</span>
        <TextArea
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          rows={2}
          spellCheck={false}
          placeholder="\\d{4}-\\d{2}-\\d{2}"
        />
      </div>

      <div className="space-y-1 text-sm">
        <span className="block font-semibold">{t.flags}</span>
        <div className="flex flex-wrap gap-1">
          {FLAGS.map(({ flag, label }) => (
            <button
              key={flag}
              type="button"
              onClick={() => toggleFlag(flag)}
              aria-pressed={flags.includes(flag)}
              title={label}
              className={chipClass(flags.includes(flag))}
            >
              {flag}
            </button>
          ))}
        </div>
      </div>

      {result.error && <Alert variant="error">{result.error}</Alert>}

      <div className="space-y-2">
        <span className="block text-sm font-semibold">{t.testString}</span>
        <TextArea
          value={subject}
          onChange={e => setSubject(e.target.value)}
          rows={6}
          spellCheck={false}
        />
      </div>

      {subject && !result.error && (
        <div className="space-y-2">
          <span className="text-sm font-semibold">
            {t.matchesN(result.matches.length)}
            {result.truncated && ` · ${t.truncated}`}
          </span>
          <pre
            className="overflow-x-auto whitespace-pre-wrap break-words border-2 border-border bg-muted p-3 font-mono text-sm [&_mark.rx-hl]:bg-accent [&_mark.rx-hl]:text-accent-foreground [&_mark.rx-hl-alt]:bg-yellow-300 [&_mark.rx-hl-alt]:dark:bg-yellow-500 [&_mark]:rounded-sm [&_mark]:px-0.5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}

      {result.matches.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-y-auto border-2 border-border p-3">
          {result.matches.map((m, i) => (
            <div key={i} className="border-b border-border pb-2 text-sm last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono font-bold">#{i + 1}</span>
                <span className="text-muted-foreground">@{m.index}</span>
                <span className="font-mono">{m.value || '(empty)'}</span>
              </div>
              {m.groups.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {t.groups}: {m.groups.map((g, gi) => `$${gi + 1}=${g ?? '∅'}`).join('  ')}
                </div>
              )}
              {Object.keys(m.named).length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {t.named}: {Object.entries(m.named).map(([k, v]) => `${k}=${v ?? '∅'}`).join('  ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {subject && !result.error && result.matches.length === 0 && (
        <p className="text-sm text-muted-foreground">{t.noMatches}</p>
      )}

      <div className="space-y-2 border-t-2 border-border pt-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <label className="space-y-1 text-sm">
            <span className="block font-semibold">{t.language}</span>
            <select
              value={target}
              onChange={e => setTarget(e.target.value as RegexLang)}
              className="border-2 border-border bg-background px-2 py-1.5 text-sm"
            >
              {LANGUAGES.map(l => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </label>
          <span className="mr-auto text-sm font-semibold">{t.equivalent}</span>
          <CopyButton value={snippet} />
        </div>
        <TextArea value={snippet} readOnly rows={8} spellCheck={false} />
        {warnings.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.notes}</span>
            {warnings.map((warn, i) => (
              <p key={i} className="text-sm text-amber-700 dark:text-amber-400">⚠ {warn}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
