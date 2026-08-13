/**
 * Regex tester core — pure, framework-free logic.
 *
 * Matching runs on the native JavaScript `RegExp` engine (the only regex
 * engine a browser can execute). The multi-language features are honest
 * layers on top: `codeSnippet` renders idiomatic code for other languages,
 * and `flavorWarnings` flags syntax whose meaning differs in that flavor.
 */

export type RegexLang = 'javascript' | 'python' | 'php' | 'java' | 'go' | 'csharp' | 'ruby';

export interface RegexMatch {
  index: number;
  value: string;
  /** Numbered capture groups (1..n); `undefined` for groups that didn't match. */
  groups: (string | undefined)[];
  /** Named capture groups. */
  named: Record<string, string | undefined>;
}

export interface RegexResult {
  matches: RegexMatch[];
  error?: string;
  /** Set when the match count hit the cap. */
  truncated?: boolean;
}

const MAX_MATCHES = 10000;

export const FLAGS: { flag: string; label: string }[] = [
  { flag: 'g', label: 'global' },
  { flag: 'i', label: 'ignore case' },
  { flag: 'm', label: 'multiline' },
  { flag: 's', label: 'dotall' },
  { flag: 'u', label: 'unicode' },
  { flag: 'y', label: 'sticky' },
];

export const LANGUAGES: { id: RegexLang; label: string }[] = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'php', label: 'PHP (PCRE)' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
  { id: 'csharp', label: 'C# / .NET' },
  { id: 'ruby', label: 'Ruby' },
];

/** Run `pattern`/`flags` against `subject`, returning matches or an error. */
export function runRegex(pattern: string, flags: string, subject: string): RegexResult {
  if (!pattern) return { matches: [] };
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (e) {
    return { matches: [], error: e instanceof Error ? e.message : 'Invalid regular expression' };
  }

  const matches: RegexMatch[] = [];
  const global = re.global || re.sticky;

  const push = (m: RegExpExecArray) => {
    matches.push({
      index: m.index,
      value: m[0],
      groups: m.slice(1),
      named: m.groups ? { ...m.groups } : {},
    });
  };

  try {
    if (!global) {
      const m = re.exec(subject);
      if (m) push(m);
      return { matches };
    }
    let m: RegExpExecArray | null;
    let truncated = false;
    while ((m = re.exec(subject)) !== null) {
      push(m);
      // Guard against zero-width matches looping forever.
      if (m.index === re.lastIndex) re.lastIndex += 1;
      if (matches.length >= MAX_MATCHES) {
        truncated = true;
        break;
      }
    }
    return truncated ? { matches, truncated } : { matches };
  } catch (e) {
    return { matches, error: e instanceof Error ? e.message : 'Matching failed' };
  }
}

/** Escape the five characters that matter inside HTML text/attribute content. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build HTML for the subject with each (non-zero-width) match wrapped in a
 * `<mark>`. The subject is escaped first, so the result is safe to inject via
 * `dangerouslySetInnerHTML`. Adjacent matches alternate class for contrast.
 */
export function highlightHtml(subject: string, matches: RegexMatch[]): string {
  const ranges = matches
    .filter(m => m.value.length > 0)
    .map(m => ({ start: m.index, end: m.index + m.value.length }))
    .sort((a, b) => a.start - b.start);

  let html = '';
  let cursor = 0;
  let alt = false;
  for (const { start, end } of ranges) {
    if (start < cursor) continue; // skip overlaps
    html += escapeHtml(subject.slice(cursor, start));
    const cls = alt ? 'rx-hl rx-hl-alt' : 'rx-hl';
    html += `<mark class="${cls}">${escapeHtml(subject.slice(start, end))}</mark>`;
    cursor = end;
    alt = !alt;
  }
  html += escapeHtml(subject.slice(cursor));
  return html;
}

// --- Per-language string-literal encoders -------------------------------------

/** Escape `/` that is not already backslash-escaped (respecting escape runs). */
function escapeDelimiter(pattern: string, delim: string): string {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') {
      out += c + (pattern[i + 1] ?? '');
      i++;
      continue;
    }
    out += c === delim ? '\\' + c : c;
  }
  return out;
}

/** Encode into a double-quoted literal (backslash + quote escaped). */
function doubleQuoted(pattern: string): string {
  return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// --- Flag mapping -------------------------------------------------------------

function has(flags: string, f: string): boolean {
  return flags.includes(f);
}

function mapFlags(flags: string, table: Record<string, string>, joiner: string): string {
  const parts: string[] = [];
  for (const f of Object.keys(table)) if (has(flags, f)) parts.push(table[f]);
  return parts.join(joiner);
}

/** Inline-flag string for engines that take `(?ims)` prefixes (Go). */
function inlineFlags(flags: string): string {
  const s = ['i', 'm', 's'].filter(f => has(flags, f)).join('');
  return s ? `(?${s})` : '';
}

// --- Code snippet generation --------------------------------------------------

/** Generate an idiomatic "find all matches" snippet for `lang`. */
export function codeSnippet(lang: RegexLang, pattern: string, flags: string): string {
  const p = pattern || '';
  switch (lang) {
    case 'javascript': {
      const f = flags || '';
      const iter = has(f, 'g')
        ? `for (const m of text.matchAll(re)) {\n  console.log(m[0], m.index, m.groups);\n}`
        : `const m = re.exec(text);\nif (m) console.log(m[0], m.index, m.groups);`;
      return `const re = /${escapeDelimiter(p, '/')}/${f};\n// text = your input string\n${iter}`;
    }
    case 'python': {
      const opts = mapFlags(flags, { i: 're.IGNORECASE', m: 're.MULTILINE', s: 're.DOTALL', x: 're.VERBOSE' }, ' | ');
      const arg = opts ? `, ${opts}` : '';
      return `import re\n\npattern = re.compile(r"${p.replace(/"/g, '\\"')}"${arg})\nfor m in pattern.finditer(text):\n    print(m.group(), m.start(), m.groupdict())`;
    }
    case 'php': {
      const mods = ['i', 'm', 's', 'u', 'x'].filter(f => has(flags, f)).join('');
      return `<?php\npreg_match_all('/${escapeDelimiter(p, '/')}/${mods}', $text, $matches, PREG_OFFSET_CAPTURE);\nprint_r($matches);`;
    }
    case 'java': {
      const opts = mapFlags(flags, {
        i: 'Pattern.CASE_INSENSITIVE',
        m: 'Pattern.MULTILINE',
        s: 'Pattern.DOTALL',
        u: 'Pattern.UNICODE_CASE',
        x: 'Pattern.COMMENTS',
      }, ' | ');
      const arg = opts ? `, ${opts}` : '';
      return `import java.util.regex.*;\n\nPattern p = Pattern.compile("${doubleQuoted(p)}"${arg});\nMatcher m = p.matcher(text);\nwhile (m.find()) {\n    System.out.println(m.group() + " @ " + m.start());\n}`;
    }
    case 'go': {
      const prefix = inlineFlags(flags);
      const body = prefix + p;
      // Backtick raw literal unless the pattern contains a backtick.
      const lit = body.includes('`') ? `"${doubleQuoted(body)}"` : '`' + body + '`';
      return `package main\n\nimport (\n\t"fmt"\n\t"regexp"\n)\n\nfunc main() {\n\tre := regexp.MustCompile(${lit})\n\tfor _, m := range re.FindAllString(text, -1) {\n\t\tfmt.Println(m)\n\t}\n}`;
    }
    case 'csharp': {
      const opts = mapFlags(flags, {
        i: 'RegexOptions.IgnoreCase',
        m: 'RegexOptions.Multiline',
        s: 'RegexOptions.Singleline',
        x: 'RegexOptions.IgnorePatternWhitespace',
      }, ' | ');
      const arg = opts ? `, ${opts}` : '';
      return `using System.Text.RegularExpressions;\n\nvar re = new Regex(@"${p.replace(/"/g, '""')}"${arg});\nforeach (Match m in re.Matches(text))\n    Console.WriteLine($"{m.Value} @ {m.Index}");`;
    }
    case 'ruby': {
      // Ruby: /m means dotall; JS `s` maps to Ruby `m`. JS `m` has no Ruby flag.
      const mods = (has(flags, 'i') ? 'i' : '') + (has(flags, 's') ? 'm' : '') + (has(flags, 'x') ? 'x' : '');
      return `re = /${escapeDelimiter(p, '/')}/${mods}\ntext.scan(re) { puts Regexp.last_match.inspect }`;
    }
  }
}

// --- Flavor warnings ----------------------------------------------------------

const HAS_LOOKBEHIND = /\(\?<[=!]/;
const HAS_LOOKAHEAD = /\(\?[=!]/;
const HAS_NAMED_GROUP = /\(\?<[A-Za-z_]/;
const HAS_BACKREF = /\\[1-9]|\\k</;

/** Heuristic warnings about pattern/flag constructs that differ in `lang`. */
export function flavorWarnings(pattern: string, flags: string, lang: RegexLang): string[] {
  const w: string[] = [];
  const namedGroup = HAS_NAMED_GROUP.test(pattern);
  const lookbehind = HAS_LOOKBEHIND.test(pattern);
  const lookahead = HAS_LOOKAHEAD.test(pattern);
  const backref = HAS_BACKREF.test(pattern);

  if (lang === 'go') {
    if (lookbehind) w.push("Go's RE2 engine does not support lookbehind — this pattern will not compile as-is.");
    if (lookahead) w.push("Go's RE2 engine does not support lookahead — this pattern will not compile as-is.");
    if (backref) w.push('Go\'s RE2 engine does not support backreferences.');
    if (namedGroup) w.push('Go names groups with (?P<name>…), not (?<name>…).');
  }

  if (lang === 'python') {
    if (namedGroup) w.push('Python names groups with (?P<name>…), not (?<name>…).');
  }

  if (lang === 'ruby') {
    if (has(flags, 's')) w.push('Ruby has no “dotall” flag — its /m flag makes the dot match newlines, so JS “s” maps to Ruby “m”.');
    if (has(flags, 'm')) w.push('Ruby has no “multiline” flag; ^ and $ already match at line boundaries by default (JS “m” has no Ruby equivalent).');
  }

  if (has(flags, 'y') && lang !== 'javascript') {
    w.push('The sticky (y) flag is JavaScript-specific; other languages anchor matches through their APIs instead.');
  }

  return w;
}
