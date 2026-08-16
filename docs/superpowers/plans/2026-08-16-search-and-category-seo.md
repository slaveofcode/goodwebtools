# Search matching + Category-hub SEO

**Date:** 2026-08-16.

## 1. Search — surface all tools (fixes "signed" not finding Sign PDF)
- `calculateScore` in `tools.ts` rewritten: tokenize query + fields, match by exact / prefix (either direction, min 3 chars) / crude English stem (signed→sign, images→image, converting→convert). Every query token must match somewhere (AND); bonuses for exact-name and whole-query substring. Unit-tested in `tools.test.ts`.
- `CommandPalette` now sets `shouldFilter={false}` so cmdk no longer re-filters on `tool.name` and hide valid keyword/stem matches — `searchTools` is the sole authority.

## 2. Category hub pages (e.g. /category/pdf) — best-effort SEO
- `categoryFaqs(category, lang)` in `categories.ts` — 4 unique, keyword-aware FAQs per category, EN + ID.
- Category page renders an accessible FAQ accordion + **FAQPage** JSON-LD (rich-result eligible), keeps the existing BreadcrumbList + ItemList schema.
- Adds sibling-category internal links (crawlability), a category note (Network), and keyword-rich `<meta keywords>` that includes every tool name in the category.
- New i18n key `category.other` (EN/ID); FAQ heading reuses `tool.faq`.

## DoD
search unit-tested (10) · full suite + lint + build green · FAQPage schema + FAQ + sibling links verified in built HTML (EN + ID) · ship develop→main→verify.
