# Sign PDF + Organize PDF + Favicon Generator — Plan

**Date:** 2026-08-14. One branch/PR/promotion.

## Favicon Generator (Image, icon AppWindow, `favicon-generator`)
Lib `src/tools/image/favicon.lib.ts`: `buildManifest`/`htmlSnippet` (pure, tested); `generateFavicons(file, name)` → ICO (`imageToIco`) + PNGs (`processImage` per size) + manifest + snippet. Island → Dropzone → preview grid → `createZip` + download.

## Organize PDF (PDF, icon ListOrdered, `pdf-organize`)
Pure `src/tools/pdf/layout.lib.ts`: `pageNumberXY` (tested). `pdf.lib.ts` gains `organizePdf(file, order, pageNumbers?)` — mupdf-normalize → copy pages in `order` into fresh doc → optional `drawText` page numbers. Island: `openPdfRenderer` thumbnails, native HTML5 drag reorder + delete, page-number controls.

## Sign PDF (PDF, icon FileSignature, `pdf-sign`)
Pure `layout.lib.ts`: `placementToPdfRect` (top-left ratio → bottom-left rect, y-flip; tested). `pdf.lib.ts` gains `signPdf(file, pngBytes, placements)` — embedPng + drawImage per placement. Island: `signature_pad` draw or PNG upload; drag-to-place over `openPdfRenderer` page; multi-page placements → `signPdf`.

## Notes
- pdf.lib gotcha honored: copy pages into a fresh `PDFDocument.create()` (never draw on the mupdf-loaded doc).
- No new DnD dep — native HTML5 drag for reorder.
- EN + ID SEO for all three (Sign PDF FAQ flags e-signature legality caveat).

## DoD
libs unit-tested · EN+ID SEO · vitest+lint+build green · 6 new routes · develop→main→live verified.
