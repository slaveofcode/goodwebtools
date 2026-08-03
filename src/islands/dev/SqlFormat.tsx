import { useEffect, useRef, useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download.service';
import type { KeywordCase, IndentKind, SqlFormatOptions } from '@/tools/dev/sql-format.lib';
import type { Lang } from '@/i18n/config';

const DIALECTS: { value: string; label: string }[] = [
  { value: 'sql', label: 'Standard SQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'tsql', label: 'SQL Server (T-SQL)' },
  { value: 'plsql', label: 'Oracle (PL/SQL)' },
  { value: 'bigquery', label: 'BigQuery' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'redshift', label: 'Redshift' },
  { value: 'spark', label: 'Spark SQL' },
  { value: 'duckdb', label: 'DuckDB' },
  { value: 'clickhouse', label: 'ClickHouse' },
  { value: 'db2', label: 'Db2' },
  { value: 'hive', label: 'Hive' },
  { value: 'trino', label: 'Trino' },
];

const CASES: KeywordCase[] = ['upper', 'lower', 'preserve'];
const INDENTS: IndentKind[] = ['2', '4', 'tab'];

const EXAMPLE = "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.active=true and o.created_at > '2024-01-01' group by u.id, u.name having count(o.id) > 3 order by orders desc limit 10;";

const TR: Record<Lang, {
  intro: string; input: string; placeholder: string; output: string; dialect: string;
  keywordCase: string; indent: string; caseLabels: Record<KeywordCase, string>; indentLabels: Record<IndentKind, string>;
  example: string; download: string; errParse: string; empty: string;
}> = {
  en: {
    intro: 'Format and beautify SQL queries in your browser — pick your database dialect, keyword case and indentation. Everything runs on your device; nothing is uploaded.',
    input: 'SQL', placeholder: 'Paste your SQL query here…', output: 'Formatted', dialect: 'Dialect',
    keywordCase: 'Keywords', indent: 'Indent',
    caseLabels: { upper: 'UPPER', lower: 'lower', preserve: 'Keep' },
    indentLabels: { '2': '2 spaces', '4': '4 spaces', tab: 'Tab' },
    example: 'Load example', download: 'Download .sql', errParse: 'Could not parse this SQL — check the query and the selected dialect.', empty: 'Formatted SQL will appear here.',
  },
  id: {
    intro: 'Format dan rapikan kueri SQL di browser Anda — pilih dialek basis data, huruf kata kunci, dan indentasi. Semuanya berjalan di perangkat Anda; tidak ada yang diunggah.',
    input: 'SQL', placeholder: 'Tempel kueri SQL Anda di sini…', output: 'Terformat', dialect: 'Dialek',
    keywordCase: 'Kata kunci', indent: 'Indentasi',
    caseLabels: { upper: 'BESAR', lower: 'kecil', preserve: 'Biarkan' },
    indentLabels: { '2': '2 spasi', '4': '4 spasi', tab: 'Tab' },
    example: 'Muat contoh', download: 'Unduh .sql', errParse: 'Tidak dapat mengurai SQL ini — periksa kueri dan dialek yang dipilih.', empty: 'SQL terformat akan muncul di sini.',
  },
};

export default function SqlFormat({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('sql');
  const [keywordCase, setKeywordCase] = useState<KeywordCase>('upper');
  const [indent, setIndent] = useState<IndentKind>('2');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const fmtRef = useRef<((sql: string, opts: SqlFormatOptions) => string) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!input.trim()) { setOutput(''); setError(''); return; }
      try {
        if (!fmtRef.current) fmtRef.current = (await import('@/tools/dev/sql-format.lib')).formatSql;
        if (cancelled) return;
        setOutput(fmtRef.current(input, { language, keywordCase, indent }));
        setError('');
      } catch {
        if (!cancelled) setError(t.errParse);
      }
    })();
    return () => { cancelled = true; };
  }, [input, language, keywordCase, indent, t.errParse]);

  const download = () => downloadService.download(new Blob([output], { type: 'application/sql' }), 'formatted.sql');

  const segClass = (active: boolean) =>
    `border-2 px-3 py-1 text-sm font-medium transition-all ${active ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="space-y-1 text-sm">
          <span className="block font-semibold">{t.dialect}</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            {DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        <div className="space-y-1 text-sm">
          <span className="block font-semibold">{t.keywordCase}</span>
          <div className="flex gap-1">
            {CASES.map((c) => <button key={c} onClick={() => setKeywordCase(c)} aria-pressed={keywordCase === c} className={segClass(keywordCase === c)}>{t.caseLabels[c]}</button>)}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <span className="block font-semibold">{t.indent}</span>
          <div className="flex gap-1">
            {INDENTS.map((i) => <button key={i} onClick={() => setIndent(i)} aria-pressed={indent === i} className={segClass(indent === i)}>{t.indentLabels[i]}</button>)}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="mr-auto text-sm font-semibold">{t.input}</span>
            <Button variant="ghost" onClick={() => setInput(EXAMPLE)}><Sparkles className="h-4 w-4" /> {t.example}</Button>
          </div>
          <TextArea value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholder} rows={16} spellCheck={false} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="mr-auto text-sm font-semibold">{t.output}</span>
            <CopyButton value={output} />
            <Button variant="secondary" onClick={download} disabled={!output}><Download className="h-4 w-4" /> {t.download}</Button>
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <TextArea value={output} readOnly rows={16} spellCheck={false} placeholder={t.empty} />
        </div>
      </div>
    </div>
  );
}
