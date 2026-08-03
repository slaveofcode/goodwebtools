import { format, supportedDialects } from 'sql-formatter';

/** The sql-formatter option bag (its SqlLanguage type isn't re-exported at the package root). */
type FormatOpts = Parameters<typeof format>[1];

export type KeywordCase = 'upper' | 'lower' | 'preserve';
export type IndentKind = '2' | '4' | 'tab';

export interface SqlFormatOptions {
  /** A sql-formatter dialect id (e.g. 'postgresql'); unknown values fall back to 'sql'. */
  language: string;
  keywordCase: KeywordCase;
  indent: IndentKind;
}

/** Dialect ids supported by sql-formatter (e.g. postgresql, mysql, sqlite…). */
export const DIALECTS: readonly string[] = supportedDialects;

export const DEFAULT_OPTIONS: SqlFormatOptions = { language: 'sql', keywordCase: 'upper', indent: '2' };

/**
 * Pretty-print a SQL string. Throws (from sql-formatter) on unparseable input —
 * the island catches that and shows a friendly message.
 */
export function formatSql(sql: string, opts: SqlFormatOptions): string {
  if (!sql.trim()) return '';
  const language = (DIALECTS.includes(opts.language) ? opts.language : 'sql') as FormatOpts['language'];
  const cfg: FormatOpts = {
    language,
    keywordCase: opts.keywordCase,
    useTabs: opts.indent === 'tab',
    tabWidth: opts.indent === '4' ? 4 : 2,
  };
  return format(sql, cfg);
}
