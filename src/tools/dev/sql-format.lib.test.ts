import { describe, it, expect } from 'vitest';
import { formatSql, DIALECTS } from './sql-format.lib';

describe('formatSql', () => {
  it('pretty-prints and upper-cases keywords', () => {
    const out = formatSql('select id,name from users where id=1', { language: 'postgresql', keywordCase: 'upper', indent: '2' });
    expect(out).toContain('SELECT');
    expect(out).toContain('FROM');
    expect(out).toContain('WHERE');
    expect(out.split('\n').length).toBeGreaterThan(1); // multi-line
    expect(out).toContain('\n  '); // 2-space indent
  });

  it('lower-cases keywords when asked', () => {
    const out = formatSql('SELECT * FROM t', { language: 'sql', keywordCase: 'lower', indent: '2' });
    expect(out).toContain('select');
    expect(out).toContain('from');
    expect(out).not.toContain('SELECT');
  });

  it('indents with a tab when indent is "tab"', () => {
    const out = formatSql('SELECT * FROM t', { language: 'sql', keywordCase: 'upper', indent: 'tab' });
    expect(out).toContain('\t');
  });

  it('indents with 4 spaces when indent is "4"', () => {
    const out = formatSql('SELECT a FROM t', { language: 'sql', keywordCase: 'upper', indent: '4' });
    expect(out).toContain('\n    ');
  });

  it('returns empty string for blank input', () => {
    expect(formatSql('', DEFAULT())).toBe('');
    expect(formatSql('   \n  ', DEFAULT())).toBe('');
  });

  it('falls back to standard SQL for an unknown dialect', () => {
    const out = formatSql('select 1', { language: 'not-a-dialect', keywordCase: 'upper', indent: '2' });
    expect(out).toContain('SELECT');
  });

  it('exposes the supported dialect list', () => {
    expect(DIALECTS).toContain('postgresql');
    expect(DIALECTS).toContain('mysql');
    expect(DIALECTS.length).toBeGreaterThan(5);
  });
});

function DEFAULT() {
  return { language: 'sql', keywordCase: 'upper', indent: '2' } as const;
}
