# Regex Tester Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a client-side regex tester with live highlighting, capture groups, flags, and per-language code snippets + flavor warnings.

**Architecture:** Pure lib `regex.lib.ts` (run + highlight + snippet + warnings); thin island `RegexTester.tsx`; registry + SEO. Native `RegExp` only — no new deps.

**Tech Stack:** Astro + React island, Vitest, native JS `RegExp`.

## Global Constraints

- 100% client-side; matching on native `RegExp`.
- New tool `status: 'beta'`; Dev category.
- Bahasa copy uses "tool" loanword, never "alat".
- Commit under the personal noreply identity; no AI-attribution trailers; no absolute machine paths in committed files.

---

### Task 1: Pure lib `regex.lib.ts` (TDD)

**Files:** Create `src/tools/dev/regex.lib.ts`, Test `src/tools/dev/regex.lib.test.ts`.

**Interfaces produced:**
- `runRegex(pattern, flags, subject): { matches: RegexMatch[]; error?: string; truncated?: boolean }`
- `RegexMatch = { index: number; value: string; groups: (string|undefined)[]; named: Record<string,string|undefined> }`
- `escapeHtml(s): string`
- `highlightHtml(subject, matches): string`
- `codeSnippet(lang, pattern, flags): string`
- `flavorWarnings(pattern, flags, lang): string[]`
- `FLAGS`, `LANGUAGES`, type `RegexLang`

- [ ] Write failing tests covering: match/no-match, numbered + named groups, flags g/i/m/s, global iteration + zero-width guard, invalid pattern → error; `highlightHtml` escaping + `<mark>`; `codeSnippet` for each of the 7 langs (pattern encoding + flag map) via `it.each`; `flavorWarnings` (Go lookbehind → warns, Go backref → warns, Python named group → warns, Ruby `s`-flag swap → warns, plain pattern → no warnings).
- [ ] Run — confirm fail (module not found).
- [ ] Implement lib.
- [ ] Run — confirm pass.

### Task 2: Island `RegexTester.tsx`

**Files:** Create `src/islands/dev/RegexTester.tsx`.

- [ ] Pattern `TextArea`, flag toggle-chips (segmented), subject `TextArea`. `useMemo` results on `[pattern, flags, subject]`. Highlighted `<pre>` via `dangerouslySetInnerHTML(highlightHtml)`. Match list (count, index, value, groups, named). Language `<select>` → `codeSnippet` in read-only block + `CopyButton`; `flavorWarnings` shown. i18n TR en+id. Error/empty/no-match states. SSR-safe.

### Task 3: Register + SEO

**Files:** Modify `src/registry/tools.ts`, `src/registry/tool-seo.ts`.

- [ ] Import `Regex` icon; add the ToolDef.
- [ ] Add EN + ID `regex-tester` SEO entries.

### Task 4: Verify loop

- [ ] `npx vitest run` green.
- [ ] `npm run lint` 0 errors.
- [ ] `npm run build` succeeds; `/tools/regex-tester` built (EN + ID).
- [ ] Hand review: dangerouslySetInnerHTML input is always escaped first; zero-width/global infinite-loop guard; huge-input cap; reference-identity of derived props; error/empty paths.

### Task 5: Ship dev → prod

- [ ] Commit on `feat/regex-tester`, PR → develop, CI green, merge.
- [ ] Promote develop → main (`--admin`), confirm Cloudflare prod build, verify live URL.
