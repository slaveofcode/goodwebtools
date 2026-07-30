# Structured Receipt Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract editable summary fields (merchant, date, currency, subtotal, tax, total) from OCR output via a pure heuristic parser, surfaced as a "Parse as receipt" toggle in the OCR tool and a dedicated "Receipt Scanner" tool, with JSON/CSV export.

**Architecture:** Two pure libs (`receipt.lib`, `receipt-export.lib`). The OCR input→preprocess→run UI is extracted from `ImageOcr` into a shared `OcrWorkbench` component reused by both tools. A shared `ReceiptFields` component renders editable fields + export.

**Tech Stack:** React islands (Astro); existing `OcrResult` from `@/tools/image/ocr.lib`; `downloadService`; `Button`/`Alert`/`TextArea`/`CopyButton`/`Dropzone`; Vitest.

## Global Constraints

- **Branch:** `feat/image-ocr` (continues the OCR feature; the MVP is committed here).
- **Scope:** summary fields only. No line items, no batch, no locale picker. (Spec §Out of Scope).
- **Parser is pure & deterministic:** no network, no DOM — operates only on `OcrResult`. (Spec §Approach).
- **Language-pluggable keywords:** anchors live in a `ReceiptKeywords` set; ship `EN_KEYWORDS`; `parseReceipt(ocr, keywords = EN_KEYWORDS)`. (Spec §Locked Decision 5).
- **Date convention:** ambiguous numeric dates are **day-first (DD/MM/YYYY)**; fields are editable. (Spec §Heuristics).
- **Refactor is behavior-preserving:** extracting `OcrWorkbench` must not change the OCR tool's existing UX. (Spec §Constraints).
- **Test style:** Vitest, table-driven with fixture `OcrResult`s (plain objects), mirroring `src/tools/image/mono.lib.test.ts`.
- **Lint:** `npm run lint` 0 errors; no `any` in new source.
- **No commits until the user orders them** (per the user's standing instruction for this feature).

## File Structure

| File | Responsibility |
|------|----------------|
| `src/tools/image/receipt.lib.ts` (create) | `parseReceipt`, finders, `parseAmount`, `parseDate`, `ReceiptData`, `ReceiptKeywords`, `EN_KEYWORDS`. |
| `src/tools/image/receipt.lib.test.ts` (create) | Table-driven parser tests. |
| `src/tools/image/receipt-export.lib.ts` (create) | `receiptToJson`, `receiptToCsv`. |
| `src/tools/image/receipt-export.lib.test.ts` (create) | Export format/escaping tests. |
| `src/islands/image/OcrWorkbench.tsx` (create; refactor from `ImageOcr`) | Shared input→preprocess→run UI; `onResult`/`onReset` callbacks. |
| `src/islands/image/ImageOcr.tsx` (modify ×2) | Task 3: use `OcrWorkbench`. Task 4: add "Parse as receipt" toggle. |
| `src/islands/image/ReceiptFields.tsx` (create) | Editable fields form + JSON/CSV/copy export. |
| `src/islands/image/ReceiptScanner.tsx` (create) | Dedicated tool: `OcrWorkbench` + `ReceiptFields` primary + raw text collapsible. |
| `src/registry/tools.ts` (modify) | Register `image-receipt-scanner`. |

---

### Task 1: Receipt parser (`receipt.lib.ts`)

Pure heuristic parser over `OcrResult`. The logic core — build it test-first.

**Files:**
- Create: `src/tools/image/receipt.lib.ts`
- Test: `src/tools/image/receipt.lib.test.ts`

**Interfaces:**
- Consumes: `OcrResult`, `OcrLine` from `@/tools/image/ocr.lib`. `OcrLine = { text: string; box: { x:number; y:number; width:number; height:number }; confidence: number }`. `OcrResult = { text: string; lines: OcrLine[]; backend: 'webgpu'|'wasm' }`.
- Produces:
  - `interface ReceiptData { merchant: string|null; dateRaw: string|null; dateIso: string|null; currency: string|null; subtotal: number|null; tax: number|null; total: number|null }`
  - `interface ReceiptKeywords { total: string[]; totalExclude: string[]; subtotal: string[]; tax: string[] }`
  - `const EN_KEYWORDS: ReceiptKeywords`
  - `parseAmount(text: string): number | null`
  - `parseDate(text: string): { raw: string; iso: string } | null`
  - `parseReceipt(ocr: OcrResult, keywords?: ReceiptKeywords): ReceiptData`

- [ ] **Step 1: Write the failing test**

Create `src/tools/image/receipt.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAmount, parseDate, parseReceipt, EN_KEYWORDS, type ReceiptData } from './receipt.lib';
import type { OcrResult, OcrLine } from './ocr.lib';

// Build an OcrResult from [text, y] pairs (x=0, fixed size). y drives layout.
function ocr(rows: [string, number][]): OcrResult {
  const lines: OcrLine[] = rows.map(([text, y]) => ({
    text,
    box: { x: 0, y, width: 100, height: 12 },
    confidence: 0.9,
  }));
  return { text: rows.map((r) => r[0]).join('\n'), lines, backend: 'wasm' };
}

describe('parseAmount', () => {
  const cases: [string, number | null][] = [
    ['$12.34', 12.34],
    ['TOTAL 1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['12,50', 12.5],
    ['1,234', 1234],
    ['no digits here', null],
  ];
  it.each(cases)('parses %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });
});

describe('parseDate', () => {
  it('parses ISO YYYY-MM-DD', () => {
    expect(parseDate('Date: 2026-02-01')).toEqual({ raw: '2026-02-01', iso: '2026-02-01' });
  });
  it('parses numeric dates day-first', () => {
    expect(parseDate('01/02/2026')).toEqual({ raw: '01/02/2026', iso: '2026-02-01' });
  });
  it('parses "5 Jan 2026"', () => {
    expect(parseDate('5 Jan 2026')?.iso).toBe('2026-01-05');
  });
  it('parses "Jan 5, 2026"', () => {
    expect(parseDate('Jan 5, 2026')?.iso).toBe('2026-01-05');
  });
  it('returns null when no date', () => {
    expect(parseDate('THANK YOU')).toBeNull();
  });
});

describe('parseReceipt', () => {
  it('extracts all summary fields and disambiguates total from subtotal/tax', () => {
    const result = parseReceipt(
      ocr([
        ['BLUE BOTTLE COFFEE', 0],
        ['123 Main St', 10],
        ['Date: 02/03/2026', 20],
        ['Latte $4.50', 40],
        ['Subtotal $9.00', 60],
        ['Tax $0.90', 70],
        ['TOTAL $9.90', 80],
        ['VISA ****1234', 100],
      ]),
    );
    const expected: ReceiptData = {
      merchant: 'BLUE BOTTLE COFFEE',
      dateRaw: '02/03/2026',
      dateIso: '2026-03-02',
      currency: '$',
      subtotal: 9.0,
      tax: 0.9,
      total: 9.9,
    };
    expect(result).toEqual(expected);
  });

  it('prefers "Grand Total" and handles "Amount Due" keyword variants', () => {
    const r = parseReceipt(ocr([['Amount Due USD 42.00', 50], ['Grand Total USD 42.00', 60]]));
    expect(r.total).toBe(42);
    expect(r.currency).toBe('USD');
  });

  it('returns all-null when nothing matches', () => {
    expect(parseReceipt(ocr([['xxxxx', 0], ['yyyyy', 10]]))).toEqual({
      merchant: 'xxxxx', dateRaw: null, dateIso: null, currency: null, subtotal: null, tax: null, total: null,
    });
  });

  it('accepts a custom keyword set', () => {
    const idKeywords = { ...EN_KEYWORDS, total: ['jumlah'], totalExclude: ['pajak'] };
    const r = parseReceipt(ocr([['Jumlah 15.00', 50]]), idKeywords);
    expect(r.total).toBe(15);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/image/receipt.lib.test.ts`
Expected: FAIL — `./receipt.lib` not found.

- [ ] **Step 3: Write the implementation**

Create `src/tools/image/receipt.lib.ts`:

```ts
import type { OcrResult, OcrLine } from './ocr.lib';

export interface ReceiptData {
  merchant: string | null;
  dateRaw: string | null;
  dateIso: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
}

export interface ReceiptKeywords {
  total: string[];
  totalExclude: string[];
  subtotal: string[];
  tax: string[];
}

export const EN_KEYWORDS: ReceiptKeywords = {
  total: ['grand total', 'amount due', 'balance due', 'total'],
  totalExclude: ['subtotal', 'sub total', 'tax', 'vat', 'gst'],
  subtotal: ['subtotal', 'sub total'],
  tax: ['tax', 'vat', 'gst'],
};

const NUMBER_RE = /\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2}|\d{1,3}(?:[.,]\d{3})+|\d+/g;

// Normalize a single numeric token (handles 1,234.56 / 1.234,56 / 12,50 / 1,234 / 12).
function normalizeNumber(tok: string): number | null {
  let s = tok;
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = /,\d{2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes('.')) {
    if (!/\.\d{2}$/.test(s)) s = s.replace(/\./g, ''); // dots are thousands unless 2 trailing digits
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Extract a monetary amount from a line: prefer a 2-decimal (money) token, else the largest number. */
export function parseAmount(text: string): number | null {
  const tokens = text.match(NUMBER_RE);
  if (!tokens) return null;
  const money = tokens.filter((t) => /[.,]\d{2}$/.test(t));
  if (money.length) return normalizeNumber(money[money.length - 1]);
  const nums = tokens.map(normalizeNumber).filter((n): n is number => n !== null);
  return nums.length ? Math.max(...nums) : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');
const normYear = (y: string) => (Number(y) < 100 ? 2000 + Number(y) : Number(y));

/** Detect a date; ambiguous numeric dates are read day-first (DD/MM/YYYY). */
export function parseDate(text: string): { raw: string; iso: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
    return { raw: m[0], iso: `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` };
  }
  if ((m = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/))) {
    return { raw: m[0], iso: `${normYear(m[3])}-${pad(+m[2])}-${pad(+m[1])}` };
  }
  if ((m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})\b/))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return { raw: m[0], iso: `${m[3]}-${pad(mo)}-${pad(+m[1])}` };
  }
  if ((m = text.match(/\b([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})\b/))) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return { raw: m[0], iso: `${m[3]}-${pad(mo)}-${pad(+m[2])}` };
  }
  return null;
}

function hasAny(text: string, kws: string[]): boolean {
  const t = text.toLowerCase();
  return kws.some((k) => t.includes(k));
}

function amountOnKeywordLine(lines: OcrLine[], kws: string[], exclude: string[] = []): OcrLine[] {
  return lines.filter((l) => hasAny(l.text, kws) && !hasAny(l.text, exclude) && parseAmount(l.text) !== null);
}

function findTotal(lines: OcrLine[], kw: ReceiptKeywords): number | null {
  const cands = amountOnKeywordLine(lines, kw.total, kw.totalExclude);
  if (!cands.length) return null;
  cands.sort((a, b) => b.box.y - a.box.y || (parseAmount(b.text)! - parseAmount(a.text)!));
  return parseAmount(cands[0].text);
}

function firstAmount(lines: OcrLine[], kws: string[]): number | null {
  const c = amountOnKeywordLine(lines, kws);
  return c.length ? parseAmount(c[0].text) : null;
}

const CURRENCY_RE = /([$€£¥₹])|\b(USD|EUR|GBP|JPY|IDR|Rp)\b/i;
function findCurrency(lines: OcrLine[]): string | null {
  for (const l of lines) {
    const m = l.text.match(CURRENCY_RE);
    if (m) return m[1] ?? m[2];
  }
  return null;
}

function isAmountOnly(text: string): boolean {
  return /^[\s$€£¥₹]*[\d.,\s]+$/.test(text.trim());
}
function findMerchant(lines: OcrLine[], kw: ReceiptKeywords): string | null {
  const sorted = [...lines].sort((a, b) => a.box.y - b.box.y);
  const skip = [...kw.total, ...kw.subtotal, ...kw.tax];
  for (const l of sorted) {
    const t = l.text.trim();
    if (!t || parseDate(t) || isAmountOnly(t) || hasAny(t, skip)) continue;
    return t;
  }
  return null;
}

export function parseReceipt(ocr: OcrResult, keywords: ReceiptKeywords = EN_KEYWORDS): ReceiptData {
  const { lines } = ocr;
  const date = parseDate(lines.map((l) => l.text).join('\n'));
  return {
    merchant: findMerchant(lines, keywords),
    dateRaw: date?.raw ?? null,
    dateIso: date?.iso ?? null,
    currency: findCurrency(lines),
    subtotal: firstAmount(lines, keywords.subtotal),
    tax: firstAmount(lines, keywords.tax),
    total: findTotal(lines, keywords),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/tools/image/receipt.lib.test.ts`
Expected: PASS (parseAmount 6 cases, parseDate 5, parseReceipt 4).

> If a case fails, fix the implementation (not the test) — the tests encode the spec's required behavior.

- [ ] **Step 5: (Hold commit per user instruction.)**

---

### Task 2: Export helpers (`receipt-export.lib.ts`)

**Files:**
- Create: `src/tools/image/receipt-export.lib.ts`
- Test: `src/tools/image/receipt-export.lib.test.ts`

**Interfaces:**
- Consumes: `ReceiptData` from `./receipt.lib`.
- Produces: `receiptToJson(d: ReceiptData): string`, `receiptToCsv(d: ReceiptData): string`.

- [ ] **Step 1: Write the failing test**

Create `src/tools/image/receipt-export.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { receiptToJson, receiptToCsv } from './receipt-export.lib';
import type { ReceiptData } from './receipt.lib';

const sample: ReceiptData = {
  merchant: 'Blue Bottle', dateRaw: '02/03/2026', dateIso: '2026-03-02',
  currency: '$', subtotal: 9, tax: 0.9, total: 9.9,
};

describe('receiptToJson', () => {
  it('round-trips to the same object', () => {
    expect(JSON.parse(receiptToJson(sample))).toEqual(sample);
  });
});

describe('receiptToCsv', () => {
  it('emits a header and one row', () => {
    const csv = receiptToCsv(sample);
    const [header, row] = csv.split('\n');
    expect(header).toBe('merchant,dateRaw,dateIso,currency,subtotal,tax,total');
    expect(row).toBe('Blue Bottle,02/03/2026,2026-03-02,$,9,0.9,9.9');
  });
  it('quotes and escapes fields containing commas or quotes', () => {
    const row = receiptToCsv({ ...sample, merchant: 'A, "B" Store' }).split('\n')[1];
    expect(row.startsWith('"A, ""B"" Store",')).toBe(true);
  });
  it('renders null fields as empty cells', () => {
    const row = receiptToCsv({ ...sample, tax: null, dateRaw: null }).split('\n')[1];
    expect(row).toBe('Blue Bottle,,2026-03-02,$,9,,9.9');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/image/receipt-export.lib.test.ts`
Expected: FAIL — `./receipt-export.lib` not found.

- [ ] **Step 3: Write the implementation**

Create `src/tools/image/receipt-export.lib.ts`:

```ts
import type { ReceiptData } from './receipt.lib';

const FIELDS: (keyof ReceiptData)[] = ['merchant', 'dateRaw', 'dateIso', 'currency', 'subtotal', 'tax', 'total'];

export function receiptToJson(d: ReceiptData): string {
  return JSON.stringify(d, null, 2);
}

function csvCell(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function receiptToCsv(d: ReceiptData): string {
  const header = FIELDS.join(',');
  const row = FIELDS.map((f) => csvCell(d[f])).join(',');
  return `${header}\n${row}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/tools/image/receipt-export.lib.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: (Hold commit.)**

---

### Task 3: Extract `OcrWorkbench` (behavior-preserving refactor)

Pull the input→preprocess→run UI out of `ImageOcr` into a shared component. `ImageOcr` keeps its exact current behavior (raw-text output, backend note, copy, download) but delegates the pipeline to `OcrWorkbench`.

**Files:**
- Create: `src/islands/image/OcrWorkbench.tsx`
- Modify: `src/islands/image/ImageOcr.tsx` (replace pipeline internals with `<OcrWorkbench>`)

**Interfaces:**
- Consumes: `recognize`, `OcrError`, `type OcrResult` from `@/tools/image/ocr.lib`; `applyCleanup`, `rotate90` from `@/tools/image/ocr-preprocess.lib`; `getPdfPageCount`, `renderPdfPage` from `@/tools/image/ocr-pdf.lib`; `usePasteImage`; `Dropzone`/`Button`/`Alert`.
- Produces: `OcrWorkbench` — `export default function OcrWorkbench(props: { onResult: (result: OcrResult) => void; onReset: () => void })`.

- [ ] **Step 1: Create `OcrWorkbench.tsx`**

Create `src/islands/image/OcrWorkbench.tsx` (this is the pipeline lifted verbatim from the current `ImageOcr`, minus the results rendering, ending in `onResult(result)`):

```tsx
import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { usePasteImage } from '@/hooks/usePasteImage';
import { applyCleanup, rotate90 } from '@/tools/image/ocr-preprocess.lib';
import { recognize, OcrError, type OcrResult } from '@/tools/image/ocr.lib';
import { getPdfPageCount, renderPdfPage } from '@/tools/image/ocr-pdf.lib';

const MAX_DIM = 2000;

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return ctx.getImageData(0, 0, w, h);
}

function buildAdjusted(
  base: ImageData,
  opts: { quarters: number; cleanup: boolean; threshold: number },
): HTMLCanvasElement {
  let img = base;
  for (let i = 0; i < opts.quarters; i++) img = rotate90(img);
  if (opts.cleanup) img = applyCleanup(img, { threshold: opts.threshold });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  const sink = ctx.createImageData(img.width, img.height);
  sink.data.set(img.data);
  ctx.putImageData(sink, 0, 0);
  return canvas;
}

export default function OcrWorkbench({ onResult, onReset }: { onResult: (result: OcrResult) => void; onReset: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [base, setBase] = useState<ImageData | null>(null);
  const [quarters, setQuarters] = useState(0);
  const [cleanup, setCleanup] = useState(false);
  const [threshold, setThreshold] = useState(140);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  const reset = () => {
    setBase(null); setError(''); setRetryable(false);
    setQuarters(0); setCleanup(false); setPage(1); setPageCount(0);
    onReset();
  };

  const onDrop = async (files: File[]) => {
    const f = files.find((x) => x.type.startsWith('image/') || x.type === 'application/pdf') ?? null;
    reset();
    setFile(f);
    if (!f) return;
    const pdf = f.type === 'application/pdf';
    setIsPdf(pdf);
    try {
      if (pdf) {
        setPageCount(await getPdfPageCount(f));
        setBase(await blobToImageData(await renderPdfPage(f, 1)));
      } else {
        setBase(await blobToImageData(f));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that file.');
    }
  };
  usePasteImage((f) => onDrop([f]));

  useEffect(() => {
    if (!file || !isPdf || pageCount === 0) return;
    let alive = true;
    renderPdfPage(file, page)
      .then(blobToImageData)
      .then((d) => alive && setBase(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not render that page.'));
    return () => { alive = false; };
  }, [file, isPdf, page, pageCount]);

  useEffect(() => {
    if (!base || !previewRef.current) return;
    const canvas = buildAdjusted(base, { quarters, cleanup, threshold });
    const el = previewRef.current;
    el.width = canvas.width;
    el.height = canvas.height;
    el.getContext('2d')?.drawImage(canvas, 0, 0);
  }, [base, quarters, cleanup, threshold]);

  const runOcr = async () => {
    if (!base) return;
    setBusy(true); setError(''); setRetryable(false);
    try {
      const result = await recognize(buildAdjusted(base, { quarters, cleanup, threshold }));
      onResult(result);
    } catch (e) {
      if (e instanceof OcrError) {
        setError(e.message);
        setRetryable(e.reason === 'model-download');
      } else {
        setError(e instanceof Error ? e.message : 'OCR failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*,application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or PDF, or click to browse</p>
          <p className="text-sm text-muted-foreground">Runs on-device · or paste (⌘V). First use downloads the OCR model once.</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      {isPdf && pageCount > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span>Page {page} / {pageCount}</span>
          <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {base && (
        <div className="space-y-3">
          <canvas ref={previewRef} className="max-h-96 w-auto border-2 border-border" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setQuarters((q) => (q + 1) % 4)}>Rotate 90°</Button>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={cleanup} onChange={(e) => setCleanup(e.target.checked)} />
              Clean up image
            </label>
            {cleanup && (
              <label className="flex items-center gap-2 text-sm">
                <span className="uppercase tracking-wide text-muted-foreground">Threshold {threshold}</span>
                <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="accent-accent" />
              </label>
            )}
            <Button onClick={runOcr} disabled={busy}>{busy ? 'Reading…' : 'Run OCR'}</Button>
          </div>
          {busy && (
            <p className="animate-pulse text-sm text-muted-foreground">
              Extracting text… (first run downloads the OCR model once)
            </p>
          )}
        </div>
      )}

      {error && (
        <Alert variant="error">
          {error}
          {retryable && <> <button className="underline" onClick={runOcr}>Retry</button></>}
        </Alert>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `ImageOcr.tsx` to use `OcrWorkbench`**

Replace the entire contents of `src/islands/image/ImageOcr.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import { type OcrResult } from '@/tools/image/ocr.lib';
import OcrWorkbench from './OcrWorkbench';

export default function ImageOcr() {
  const [result, setResult] = useState<OcrResult | null>(null);
  const [text, setText] = useState('');

  useEffect(() => { setText(result?.text ?? ''); }, [result]);

  const download = () => downloadService.download(new Blob([text], { type: 'text/plain' }), 'ocr.txt');

  return (
    <div className="space-y-4">
      <OcrWorkbench onResult={setResult} onReset={() => setResult(null)} />

      {result && (
        <div className="space-y-2">
          {result.backend === 'wasm' && (
            <p className="text-xs text-muted-foreground">
              Ran in slower CPU (WASM) mode — WebGPU isn’t available in this browser.
            </p>
          )}
          <TextArea label="Recognized text" value={text} onChange={(e) => setText(e.target.value)} rows={12} />
          <div className="flex gap-2">
            <CopyButton value={text} />
            <Button variant="secondary" onClick={download}>Download .txt</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the OCR tool still builds and behaves**

Run: `npx vitest run` — Expected: all existing tests still pass (no test imported the old `ImageOcr` internals).
Run: `npm run build` — Expected: succeeds; `/tools/image-ocr` page builds.
Manual: `npm run dev` → `/tools/image-ocr` still works exactly as before (drop image → Run OCR → text + copy + download).

- [ ] **Step 4: (Hold commit.)**

---

### Task 4: `ReceiptFields` + "Parse as receipt" toggle in the OCR tool

**Files:**
- Create: `src/islands/image/ReceiptFields.tsx`
- Modify: `src/islands/image/ImageOcr.tsx` (add toggle)

**Interfaces:**
- Consumes: `type ReceiptData` from `@/tools/image/receipt.lib`; `receiptToJson`, `receiptToCsv` from `@/tools/image/receipt-export.lib`; `downloadService`; `Button`/`CopyButton`.
- Produces: `ReceiptFields` — `export default function ReceiptFields({ data }: { data: ReceiptData })`.

- [ ] **Step 1: Create `ReceiptFields.tsx`**

Create `src/islands/image/ReceiptFields.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import type { ReceiptData } from '@/tools/image/receipt.lib';
import { receiptToJson, receiptToCsv } from '@/tools/image/receipt-export.lib';

const FIELDS: { key: keyof ReceiptData; label: string }[] = [
  { key: 'merchant', label: 'Merchant' },
  { key: 'dateRaw', label: 'Date (as printed)' },
  { key: 'dateIso', label: 'Date (ISO)' },
  { key: 'currency', label: 'Currency' },
  { key: 'subtotal', label: 'Subtotal' },
  { key: 'tax', label: 'Tax' },
  { key: 'total', label: 'Total' },
];

// Editable string form of ReceiptData.
type Form = Record<keyof ReceiptData, string>;

function toForm(d: ReceiptData): Form {
  return {
    merchant: d.merchant ?? '', dateRaw: d.dateRaw ?? '', dateIso: d.dateIso ?? '',
    currency: d.currency ?? '', subtotal: d.subtotal?.toString() ?? '',
    tax: d.tax?.toString() ?? '', total: d.total?.toString() ?? '',
  };
}

function toData(f: Form): ReceiptData {
  const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s));
  const str = (s: string) => (s.trim() === '' ? null : s);
  return {
    merchant: str(f.merchant), dateRaw: str(f.dateRaw), dateIso: str(f.dateIso),
    currency: str(f.currency), subtotal: num(f.subtotal), tax: num(f.tax), total: num(f.total),
  };
}

export default function ReceiptFields({ data }: { data: ReceiptData }) {
  const [form, setForm] = useState<Form>(() => toForm(data));
  useEffect(() => { setForm(toForm(data)); }, [data]);

  const set = (key: keyof ReceiptData, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const current = toData(form);
  const someMissing = Object.values(current).some((v) => v === null);

  const downloadJson = () => downloadService.download(new Blob([receiptToJson(current)], { type: 'application/json' }), 'receipt.json');
  const downloadCsv = () => downloadService.download(new Blob([receiptToCsv(current)], { type: 'text/csv' }), 'receipt.csv');

  return (
    <div className="space-y-3 border-2 border-border p-3">
      <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Receipt fields</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="space-y-1 text-sm">
            <span className="block font-bold text-muted-foreground">{label}</span>
            <input
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              className="w-full border-2 border-border bg-muted px-2 py-1.5 outline-none focus:shadow-brutal-sm"
            />
          </label>
        ))}
      </div>
      {someMissing && (
        <p className="text-xs text-muted-foreground">Some fields couldn’t be detected — fill them in above.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={downloadJson}>Download JSON</Button>
        <Button variant="secondary" onClick={downloadCsv}>Download CSV</Button>
        <CopyButton value={receiptToJson(current)} label="Copy JSON" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the "Parse as receipt" toggle to `ImageOcr.tsx`**

In `src/islands/image/ImageOcr.tsx`, add the imports:

```tsx
import { parseReceipt } from '@/tools/image/receipt.lib';
import ReceiptFields from './ReceiptFields';
```

Add a state hook next to the others:

```tsx
  const [asReceipt, setAsReceipt] = useState(false);
```

Then, inside the `{result && (...)}` block, after the copy/download `<div>`, add:

```tsx
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={asReceipt} onChange={(e) => setAsReceipt(e.target.checked)} />
            Parse as receipt
          </label>
          {asReceipt && <ReceiptFields data={parseReceipt(result)} />}
```

- [ ] **Step 3: Verify**

Run: `npx vitest run` — Expected: all pass (unchanged).
Run: `npm run lint` — Expected: 0 errors.
Manual: `/tools/image-ocr` → run OCR on a receipt → tick "Parse as receipt" → fields populate and are editable; JSON/CSV download work.

- [ ] **Step 4: (Hold commit.)**

---

### Task 5: `ReceiptScanner` tool + registry

**Files:**
- Create: `src/islands/image/ReceiptScanner.tsx`
- Modify: `src/registry/tools.ts`

**Interfaces:**
- Consumes: `OcrWorkbench`, `ReceiptFields`, `parseReceipt`, `type OcrResult`.
- Produces: default-exported `ReceiptScanner` island; a registry entry `image-receipt-scanner`.

- [ ] **Step 1: Create `ReceiptScanner.tsx`**

Create `src/islands/image/ReceiptScanner.tsx`:

```tsx
import { useState } from 'react';
import { type OcrResult } from '@/tools/image/ocr.lib';
import { parseReceipt } from '@/tools/image/receipt.lib';
import OcrWorkbench from './OcrWorkbench';
import ReceiptFields from './ReceiptFields';

export default function ReceiptScanner() {
  const [result, setResult] = useState<OcrResult | null>(null);

  return (
    <div className="space-y-4">
      <OcrWorkbench onResult={setResult} onReset={() => setResult(null)} />

      {result && (
        <>
          <ReceiptFields data={parseReceipt(result)} />
          <details className="border-2 border-border p-3">
            <summary className="cursor-pointer text-sm font-bold text-muted-foreground">Raw recognized text</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-sm">{result.text}</pre>
          </details>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the tool**

In `src/registry/tools.ts`, add `Receipt` to the `lucide-react` import (append to the existing import list), then add this entry right after the `image-ocr` entry:

```ts
  {
    id: 'image-receipt-scanner',
    name: 'Receipt Scanner',
    category: 'Image',
    route: '/tools/image-receipt-scanner',
    keywords: ['receipt', 'scanner', 'expense', 'invoice', 'ocr', 'extract', 'total', 'merchant'],
    icon: Receipt,
    summary: 'Pull merchant, date, and totals from a receipt on-device',
    load: () => import('@/islands/image/ReceiptScanner'),
    status: 'beta'
  },
```

- [ ] **Step 3: Verify build + full suite + lint**

Run: `npx vitest run` — Expected: all pass (receipt.lib + receipt-export.lib added).
Run: `npm run lint` — Expected: 0 errors.
Run: `npm run build` — Expected: succeeds; both `/tools/image-ocr` and `/tools/image-receipt-scanner` pages build.
Manual smoke: `/tools/image-receipt-scanner` → drop a receipt → Run OCR → fields populate; raw text in the collapsible; JSON/CSV export work.

- [ ] **Step 4: (Hold commit.)**

---

## Post-completion

All five tasks leave the tree uncommitted per the user's standing instruction. When the user orders it, commit as five logical commits (one per task) and then follow **superpowers:finishing-a-development-branch** to open the PR to `develop`.

## Notes / deliberate limits

- **English keywords only** (`EN_KEYWORDS`); the `ReceiptKeywords` seam makes more languages a data addition later.
- **Amount heuristic** prefers a 2-decimal "money" token, else the largest number on the keyword line — good for typical receipts, not guaranteed on exotic layouts (fields are editable).
- **Date** is day-first for ambiguous numeric dates, editable.
- No new island unit tests (islands stay thin; logic is in the tested libs) — consistent with the OCR MVP.
