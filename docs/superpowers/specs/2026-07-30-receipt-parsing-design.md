# Structured Receipt Parsing — Design Spec

**Status:** Approved (brainstorming complete)
**Date:** 2026-07-30
**Author:** brainstormed with Kresna
**Builds on:** the Image → Text (OCR) MVP (`docs/superpowers/specs/2026-07-30-image-ocr-design.md`). Consumes its `OcrResult`.
**Scope:** Summary fields only. Line items, multi-language keyword sets, batch, and a locale/date picker are deferred.

## Goal

Extract structured **summary fields** from a receipt — merchant, date, currency, subtotal, tax, total — from the OCR output, entirely client-side. Surface it two ways: a **"Parse as receipt"** toggle inside the existing Image → Text (OCR) tool, and a dedicated **"Receipt Scanner"** tool. Fields are editable and exportable as JSON and CSV.

## Locked Decisions

1. **Fields:** `merchant`, `date` (raw + best-effort ISO), `currency`, `subtotal`, `tax`, `total`. No line items.
2. **Approach:** heuristic parser over the OCR `lines[]` (text + `box` + `confidence`) — Approach A. No ML model, no API. Deterministic, private, unit-testable.
3. **Surfaces (both):** a "Parse as receipt" toggle in the OCR tool, and a dedicated "Receipt Scanner" tool. Powered by one shared pure parser.
4. **Editable + export:** all fields editable; export **JSON** and **CSV** (single row).
5. **Keywords English-only for the MVP**, but the parser is **built for language extension**: keyword anchors live in a pluggable `ReceiptKeywords` set (English shipped now), so adding a language later is a data addition, not a rewrite. Currency/date detection is largely locale-agnostic already.
6. **Date ambiguity:** keep the raw printed string plus a best-effort ISO guess the user can correct. No locale/date-format picker.
7. **Refactor approved:** extract the OCR input→preprocess→run pipeline out of `ImageOcr.tsx` into a shared `OcrWorkbench` component (behavior-preserving) so both tools reuse it.

## Architecture

The OCR MVP's input→preprocess→run UI currently lives inside `ImageOcr.tsx`. Extract it into a shared **`OcrWorkbench`** component that renders the dropzone, PDF page nav, preview, adjust controls (rotate / cleanup / threshold), and Run button, and reports results via callbacks. Both islands embed `OcrWorkbench` and render their own result section. Parsing and export are **pure libs** with no UI.

```
File/PDF ─▶ OcrWorkbench ─(OcrResult)─▶ parseReceipt ─(ReceiptData)─▶ ReceiptFields (editable) ─▶ JSON / CSV
                                         (receipt.lib)                  (shared component)      (receipt-export.lib)
```

### Components

| File | Responsibility | Tested by |
|------|----------------|-----------|
| `src/tools/image/receipt.lib.ts` (create) | Pure `parseReceipt(ocr: OcrResult): ReceiptData` + field finders. | Fixture `OcrResult`s → assert fields |
| `src/tools/image/receipt-export.lib.ts` (create) | Pure `receiptToJson(d)` / `receiptToCsv(d)`. | Format + CSV escaping |
| `src/islands/image/OcrWorkbench.tsx` (create; refactor from `ImageOcr`) | Shared input→preprocess→run UI. Props: `onResult(result: OcrResult): void`, `onReset(): void`. | Behavior-preserving; build + manual |
| `src/islands/image/ReceiptFields.tsx` (create) | Shared editable-fields form + JSON/CSV export buttons. Props: `data: ReceiptData`. | Thin UI; manual |
| `src/islands/image/ImageOcr.tsx` (modify) | Embed `OcrWorkbench`; keep raw-text output; add "Parse as receipt" toggle → `ReceiptFields`. | build + manual |
| `src/islands/image/ReceiptScanner.tsx` (create) | Embed `OcrWorkbench`; `ReceiptFields` primary + raw text collapsible. | build + manual |
| `src/registry/tools.ts` (modify) | Register `image-receipt-scanner`. | build |

### Data Model

```ts
export interface ReceiptData {
  merchant: string | null;
  dateRaw: string | null;   // as printed, e.g. "01/02/2026"
  dateIso: string | null;   // best-effort "2026-02-01" (may be wrong on ambiguous dates)
  currency: string | null;  // "USD" | "$" | "Rp" | "€" …
  subtotal: number | null;
  tax: number | null;
  total: number | null;
}
```

`ReceiptFields` holds editable string copies of these; export serializes the current (possibly user-corrected) values. A number field that the user blanks or that never parsed exports as empty/null.

## Heuristics (`receipt.lib`)

Operates on `OcrResult.lines` (each `{ text, box: {x,y,width,height}, confidence }`), already in reading order.

**Language-pluggable keywords.** Anchor words are not hardcoded in the finders — they come from a `ReceiptKeywords` set, so new languages are added as data, not code:

```ts
export interface ReceiptKeywords {
  total: string[];      // e.g. ['grand total', 'amount due', 'balance due', 'total']
  totalExclude: string[]; // e.g. ['subtotal', 'sub total', 'tax', 'vat', 'gst']
  subtotal: string[];   // e.g. ['subtotal', 'sub total']
  tax: string[];        // e.g. ['tax', 'vat', 'gst']
}
export const EN_KEYWORDS: ReceiptKeywords = { /* the English lists above */ };
```

`parseReceipt(ocr: OcrResult, keywords: ReceiptKeywords = EN_KEYWORDS): ReceiptData`. Each finder builds its matcher from the provided set. The multi-language OCR phase later adds more `ReceiptKeywords` (e.g. `ID_KEYWORDS` with `total`/`pajak`/`ppn`) and a language selector — no finder changes.

- **`findMerchant`** → the text of the top-most line(s) by `box.y` (skip lines that are only a date/amount/keyword). Returns the first substantive top line.
- **`findCurrency`** → first currency symbol (`$ € £ ¥ ₹`) or 3-letter code (`USD`, `IDR`, `Rp`…) found on any amount-bearing line.
- **amount regex** → matches money like `1,234.56` / `1.234,56` / `12.00` with optional symbol; normalized to a JS number.
- **`findTotal`** → amount on a line that contains one of `keywords.total` AND none of `keywords.totalExclude`; among candidates prefer the **bottom-most** (largest `box.y`), tie-break on largest amount.
- **`findSubtotal`** → amount on a line containing one of `keywords.subtotal`.
- **`findTax`** → amount on a line containing one of `keywords.tax`.
- **`findDate`** → first line matching a multi-format date regex (`DD/MM/YYYY`, `YYYY-MM-DD`, `DD Mon YYYY`, `Mon DD, YYYY`); returns `{ raw, iso }`. For ambiguous numeric dates the documented convention is **DD/MM/YYYY** (day-first); `iso` is the best-effort normalization under that rule, and the user can correct it since the field is editable.

Each finder returns `null` when nothing matches. `parseReceipt` assembles them into `ReceiptData`.

## UX / Data Flow

**Image → Text (OCR) tool:** unchanged raw-text output, plus a **"Parse as receipt"** checkbox. When on (and OCR has produced a result), render `ReceiptFields` below the text with the parsed values.

**Receipt Scanner tool:** `OcrWorkbench` on top; after Run, `ReceiptFields` is the primary output (merchant, date, currency, subtotal, tax, total — each an editable input), with the raw recognized text in a collapsible `<details>`. Export buttons: **Download JSON**, **Download CSV**, plus copy.

## Error Handling

- OCR failures are owned by `OcrWorkbench` (existing reason-specific `OcrError` messages + retry).
- Parsing never throws: unmatched fields are `null` → empty editable inputs. A short hint ("some fields couldn't be detected — fill them in") shows when ≥1 field is null.
- No OCR text → the existing `no-text` error path covers it; parsing isn't invoked.

## Testing

- **`receipt.lib` (Vitest, table-driven):** fixture `OcrResult`s (synthetic `lines` with `box` coords) covering:
  - total vs subtotal/tax disambiguation (a receipt with all three);
  - keyword variants (`Grand Total`, `Amount Due`, `Balance Due`);
  - several date formats → correct `raw` + `iso`;
  - currency symbol and 3-letter code;
  - merchant taken from the top line;
  - all-null when nothing matches.
- **`receipt-export.lib`:** `ReceiptData` → JSON object shape; CSV header + one row with proper quoting/escaping of commas in merchant names.
- **`OcrWorkbench` refactor:** behavior-preserving — the OCR tool's existing flow keeps working (verified by build + the OCR manual smoke). Islands stay thin; no new island unit tests (consistent with the OCR MVP).

## Constraints & Non-Functional

- **Privacy:** no new network calls; parsing is pure local computation on the OCR result.
- **Follows existing patterns:** pure-lib + thin-island split, registry `ToolDef`, existing `downloadService` for exports, Vitest fixtures.
- **Behavior-preserving refactor:** extracting `OcrWorkbench` must not change the OCR tool's current UX.

## Out of Scope (future phases)

- Line-item extraction (description / qty / unit price).
- Multi-language keyword *values* and a language selector (needs the multi-language OCR phase first) — but the pluggable `ReceiptKeywords` mechanism ships now, so this is additive.
- Batch / multi-receipt aggregate export.
- Locale/date-format picker and currency-locale configuration.
