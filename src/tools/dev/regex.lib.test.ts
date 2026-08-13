import { describe, it, expect } from 'vitest';
import {
  runRegex,
  escapeHtml,
  highlightHtml,
  codeSnippet,
  flavorWarnings,
} from './regex.lib';

describe('runRegex', () => {
  it('finds a single match with index and value', () => {
    const r = runRegex('b(a)r', '', 'foo bar baz');
    expect(r.error).toBeUndefined();
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].value).toBe('bar');
    expect(r.matches[0].index).toBe(4);
    expect(r.matches[0].groups).toEqual(['a']);
  });

  it('finds all matches with the global flag', () => {
    const r = runRegex('\\d+', 'g', 'a1 b22 c333');
    expect(r.matches.map(m => m.value)).toEqual(['1', '22', '333']);
    expect(r.matches.map(m => m.index)).toEqual([1, 4, 8]);
  });

  it('captures named groups', () => {
    const r = runRegex('(?<year>\\d{4})-(?<month>\\d{2})', '', '2026-08');
    expect(r.matches[0].named).toEqual({ year: '2026', month: '08' });
  });

  it('honors the case-insensitive flag', () => {
    expect(runRegex('abc', '', 'ABC').matches).toHaveLength(0);
    expect(runRegex('abc', 'i', 'ABC').matches).toHaveLength(1);
  });

  it('does not infinite-loop on a zero-width global match', () => {
    const r = runRegex('a*', 'g', 'aa b');
    // Zero-width matches are allowed but the loop must terminate.
    expect(r.error).toBeUndefined();
    expect(r.matches.length).toBeGreaterThan(0);
    expect(r.matches.length).toBeLessThan(50);
  });

  it('returns an error for an invalid pattern', () => {
    const r = runRegex('(', '', 'x');
    expect(r.matches).toHaveLength(0);
    expect(r.error).toBeTruthy();
  });

  it('returns an error for an invalid flag', () => {
    const r = runRegex('a', 'Z', 'a');
    expect(r.error).toBeTruthy();
  });

  it('returns no matches for empty subject without error', () => {
    const r = runRegex('a', 'g', '');
    expect(r.error).toBeUndefined();
    expect(r.matches).toHaveLength(0);
  });
});

describe('escapeHtml', () => {
  it('escapes the dangerous characters', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });
});

describe('highlightHtml', () => {
  it('wraps matches in <mark> and escapes the rest', () => {
    const r = runRegex('X', 'g', 'a<X>b');
    const html = highlightHtml('a<X>b', r.matches);
    expect(html).toContain('&lt;');
    expect(html).toContain('<mark');
    expect(html).toContain('>X</mark>');
  });

  it('returns escaped text with no marks when there are no matches', () => {
    expect(highlightHtml('a&b', [])).toBe('a&amp;b');
  });
});

describe('codeSnippet', () => {
  it.each([
    ['javascript', /\/\\d\+\/g|new RegExp/],
    ['python', /import re|re\.compile/],
    ['php', /preg_match_all/],
    ['java', /Pattern\.compile/],
    ['go', /regexp\.MustCompile/],
    ['csharp', /new Regex/],
    ['ruby', /scan|=~|\/\\d\+\//],
  ] as const)('generates %s code containing the expected API', (lang, re) => {
    const code = codeSnippet(lang, '\\d+', 'g');
    expect(code).toMatch(re);
  });

  it('maps the case-insensitive flag per language', () => {
    expect(codeSnippet('python', 'a', 'i')).toMatch(/IGNORECASE/);
    expect(codeSnippet('java', 'a', 'i')).toMatch(/CASE_INSENSITIVE/);
    expect(codeSnippet('csharp', 'a', 'i')).toMatch(/IgnoreCase/);
  });
});

describe('flavorWarnings', () => {
  it('warns that Go/RE2 has no lookbehind', () => {
    expect(flavorWarnings('(?<=x)y', '', 'go').join(' ')).toMatch(/lookbehind|RE2/i);
  });

  it('warns that Go/RE2 has no backreferences', () => {
    expect(flavorWarnings('(a)\\1', '', 'go').join(' ')).toMatch(/backreference/i);
  });

  it('warns Python uses (?P<name>) for named groups', () => {
    expect(flavorWarnings('(?<name>x)', '', 'python').join(' ')).toMatch(/\(\?P<|named group/i);
  });

  it('warns about Ruby dotall flag semantics', () => {
    expect(flavorWarnings('a.b', 's', 'ruby').join(' ')).toMatch(/dotall|multiline|Ruby/i);
  });

  it('returns no warnings for a plain pattern in its native language', () => {
    expect(flavorWarnings('\\d+', 'g', 'javascript')).toEqual([]);
  });
});
