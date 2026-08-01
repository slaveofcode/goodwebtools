# Repair PDF Tool — Design

**Date:** 2026-08-01
**Tool:** PDF → Repair PDF (`/tools/pdf-repair`) — NEW
**Type:** New tool
**Icon:** `Wrench`
**Category:** PDF

## Problem

Damaged PDFs ("this file is corrupt / won't open") are usually **structurally** broken —
a bad cross-reference (xref) table, damaged trailer, or junk appended after `%%EOF` — while
the actual page objects are intact. iLovePDF's "Repair PDF" recovers these, but uploads the
file to their servers.

## Goal

A **100% client-side** Repair PDF tool: fix structural corruption so the PDF opens again,
with the damaged file never leaving the browser.

## Approach — reuse the existing mupdf worker

The project already runs `mupdf@1.28` in a Comlink Web Worker (`mupdf.worker.ts`). mupdf is
the ideal engine: `PDFDocument.openDocument()` **rebuilds a broken xref on open**, and
re-saving with garbage-collection + sanitize writes a clean structure (this is what
`mutool clean` does).

New worker method `repair(bytes, force)`:
- **Standard** (`force=false`): `open` (auto-repairs) → `saveToBuffer('garbage=deduplicate,sanitize=yes,clean=yes')`.
- **Force-recover** (`force=true`): create a fresh `PDFDocument`, `graftPage` every page from
  the opened doc into it (skipping any page that throws), then save. This discards broken
  global structure and reconstructs from whatever pages are still readable.
- Returns `{ bytes, pages }` (repaired bytes + recovered page count) via `Comlink.transfer`.

## Files

- `mupdf.worker.ts` — add `repair`.
- `mupdf.client.ts` — `repairPdf(file, force) → { blob, pages }` (+ `RepairResult` type).
- `pdf.lib.ts` — re-export `repairPdf` / `RepairResult`.
- `src/islands/pdf/PdfRepair.tsx` — Dropzone → **Repair PDF** / **Force rebuild** → success
  (recovered page count) + `PdfPreview` + `ResultActions` (download `<name>-repaired.pdf`).
- `src/registry/tools.ts` — register `pdf-repair` (PDF, `Wrench`, beta).

## Scope / honesty

- **Fixes:** broken xref, damaged trailer/offsets, junk after EOF, "won't open" structural
  corruption.
- **Can't recover:** physically missing/overwritten content bytes; encrypted files without
  the password (that's the Unlock tool). The UI states this plainly.

## Testing

mupdf runs in a Web Worker over WASM — not headless-testable in jsdom (same as the other
PDF tools: compress/unlock/merge). Verified by the full suite still passing, build, and
manual smoke (repair a deliberately-corrupted PDF; confirm it opens and page count is
reported). Registry load test covers the new entry.

## Out of scope

- OCR/content re-extraction of image-only scans.
- Recovering a specific damaged page's content when its stream is gone.
