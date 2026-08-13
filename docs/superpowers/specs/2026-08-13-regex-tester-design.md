# Regex Tester — Design

**Date:** 2026-08-13
**Category:** Dev
**Tool id:** `regex-tester`

## Goal

A live regular-expression tester: type a pattern + flags, test it against sample text, see matches highlighted inline, inspect capture groups (numbered + named), and get the **equivalent code snippet** for the language you actually use — plus honest warnings when your pattern relies on syntax that behaves differently in that language.

## Honest engine model (decided with user)

Browsers can only natively execute **JavaScript's `RegExp`**. Rather than pretend otherwise, matching always runs on the JS engine (zero deps, instant, private). The multi-language value comes from two pure, deterministic features layered on top:

1. **Code-snippet generation** — render idiomatic "find all matches" code for the chosen language, embedding the user's pattern + mapped flags.
2. **Flavor warnings** — detect pattern/flag constructs whose semantics differ in the target language and warn precisely (e.g. Go/RE2 has no lookbehind or backreferences; Python/Go name groups with `(?P<…>)`; Ruby's `m` flag means dotall, not multiline).

Languages covered: **JavaScript, Python, PHP (PCRE), Java, Go, C#/.NET, Ruby.**

Everything is client-side. Nothing is uploaded.

## Architecture

Mirrors the `sql-format` Dev tool (text input + option controls + live derived output, pure logic in a lib).

### Pure lib — `src/tools/dev/regex.lib.ts`

- `runRegex(pattern: string, flags: string, subject: string): RegexResult`
  - `RegexResult = { matches: RegexMatch[]; error?: string; truncated?: boolean }`
  - `RegexMatch = { index: number; value: string; groups: (string | undefined)[]; named: Record<string, string | undefined> }`
  - `new RegExp(pattern, flags)` in try/catch → `{ matches: [], error }` on invalid pattern/flags.
  - Global/sticky (`g`/`y`): iterate `exec`; guard zero-width matches by advancing `lastIndex`. Cap at `MAX_MATCHES = 10000` → set `truncated`.
- `escapeHtml(s: string): string` — pure (`& < > "`).
- `highlightHtml(subject: string, matches: RegexMatch[]): string` — escape subject, wrap non-zero-width match ranges in `<mark class="rx-hl">` / alternating `rx-hl-alt` for adjacent matches; injected via `dangerouslySetInnerHTML` in a `<pre>` (mirrors `CodeBlock`).
- `FLAGS: { flag: string; label: string }[]` — g, i, m, s, u, y.
- `LANGUAGES: { id: RegexLang; label: string }[]` — the 7 flavors.
- `codeSnippet(lang: RegexLang, pattern: string, flags: string): string` — pure; per-language string-literal encoding (JS `/…/`, Python raw `r"…"`, PHP `/…/` with `/` escaped, Java double-quoted with `\`/`"` escaped, Go backtick raw with double-quoted fallback, C# verbatim `@"…"` with `"`→`""`, Ruby `/…/`) + flag mapping to each language's API.
- `flavorWarnings(pattern: string, flags: string, lang: RegexLang): string[]` — pure heuristics: named-group syntax (Python/Go), lookbehind/lookahead + backreferences (Go/RE2), Ruby `m`/`s` flag-semantics swap, sticky `y` outside JS.

All of the above are unit-tested.

### Island — `src/islands/dev/RegexTester.tsx` (default export)

- `TextArea` for pattern (single-ish line) + a segmented row of flag toggle-chips (`aria-pressed`) + `TextArea` for the test string.
- Live results via `useMemo` on `[pattern, flags, subject]` (synchronous — no dynamic import needed).
- **Highlighted subject** rendered from `highlightHtml` into a `<pre>` via `dangerouslySetInnerHTML`.
- **Match list**: count, each match's index + value + numbered groups + named groups. Empty/error/ no-match states.
- **Language panel**: native `<select>` (7 langs) → `codeSnippet` shown in a read-only block with `CopyButton`, plus any `flavorWarnings` as `Alert`s / muted notes.
- i18n `TR: Record<Lang, {...}>`; signature `export default function RegexTester({ lang = 'en' }: { lang?: Lang })`.
- SSR-safe (RegExp only touched inside `useMemo`/handlers, which is fine, but no module-scope DOM access).

### Registry — `src/registry/tools.ts`

```ts
{
  id: 'regex-tester',
  name: 'Regex Tester',
  category: 'Dev',
  route: '/tools/regex-tester',
  keywords: ['regex', 'regexp', 'regular expression', 'test', 'match', 'pattern', 'pcre', 'javascript', 'python', 'java', 'go'],
  icon: Regex,
  summary: 'Test regular expressions with live highlighting and per-language code',
  load: () => import('@/islands/dev/RegexTester'),
  status: 'beta'
},
```
`Regex` imported from `lucide-react` (the icon exists; add to the import list).

### SEO — `src/registry/tool-seo.ts`

Add `regex-tester` to both the EN block (~line 9+) and the ID block (~line 1534+). Keyword targets: "regex tester", "test regular expression online", "regex match highlighter", "Python/Java/Go regex". Bahasa uses "tool" loanword, never "alat".

### No new dependency, no globIgnores change

Native `RegExp`; nothing heavy to code-split or exclude from the PWA precache.

## Testing

`src/tools/dev/regex.lib.test.ts` — `runRegex` (match, no-match, capture groups, named groups, each flag, global iteration, zero-width guard, invalid pattern → error), `highlightHtml` (escaping + mark wrapping), `codeSnippet` (per-language literal encoding + flag mapping, `it.each`), `flavorWarnings` (Go lookbehind/backref, Python/Go named groups, Ruby flag swap).

## Definition of done

Spec+plan committed · `regex.lib.ts` unit-tested · vitest + lint + build green · `/tools/regex-tester` builds (EN + ID) · merged to develop · promoted to main · Cloudflare prod build green · live URL verified · user told about PWA hard-refresh.
