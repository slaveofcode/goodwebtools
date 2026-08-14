# Basic Text Toolkit — Plan

**Date:** 2026-08-14 · Category: Dev · Three focused tools sharing one lib.

Rationale: separate keyword-targeted pages ("word counter" alone is millions of searches/mo) beat one combined page that can only rank for one term.

## Shared lib `src/tools/dev/text.lib.ts` (pure, unit-tested)
- `countText(text): TextStats` — characters, charactersNoSpaces, words, sentences, paragraphs, lines, readingMinutes (≈200 wpm).
- Case fns + `CASES` list: upper, lower, Title, Sentence, camel, Pascal, snake, kebab, CONSTANT (tokenizer respects camelCase + separators).
- Cleanup fns + `CLEANUP_OPS` + `cleanup(text, keys)`: trimLines, collapseSpaces, removeBlankLines, removeLineBreaks, stripHtml, removeAccents (NFD + strip ̀–ͯ), dedupeLines, sortLines.

## Tools (islands, thin)
- `word-counter` (icon Baseline) → `WordCounter.tsx`: live stats grid + textarea.
- `case-converter` (icon CaseSensitive) → `CaseConverter.tsx`: input → case buttons → output + copy.
- `text-cleanup` (icon Brush) → `TextCleanup.tsx`: op checkboxes → live cleaned output + copy/download.

## Registry + SEO
3 ToolDefs in `tools.ts`; EN + ID SEO for each in `tool-seo.ts` (title/description/intro/howTo/faqs). Bahasa "tool" loanword.

## DoD
lib unit-tested (20 cases) · EN+ID SEO · vitest+lint+build green · 6 new routes built · develop→main→live verified.
