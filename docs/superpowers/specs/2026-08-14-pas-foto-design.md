# Pas Foto Maker — Design

**Date:** 2026-08-14
**Category:** Image
**Tool id:** `pas-foto`

## Goal

Make a print-ready Indonesian pas foto (ID/passport photo) in the browser: upload a portrait, auto-remove and recolor the background (red / blue / white / custom), frame it to a standard size (2×3, 3×4, 4×6 cm), and export a **print-ready PDF** that tiles many copies onto a 4R photo-paper sheet or an A4 sheet — so the user can print at a photo shop or on a home printer. Everything runs client-side; nothing is uploaded.

## Reuse (all already shipped in GWT)

- **Background removal** — `@imgly/background-removal` (dynamic import; `publicPath: /models/imgly/`), returns a transparent PNG `Blob`. Same block as `BackgroundRemove.tsx`.
- **PDF** — `pdf-lib` (`imagesToPdf` pattern in `src/tools/pdf/pdf.lib.ts`): `PDFDocument.create()` → `embedPng` → `addPage([wPt,hPt])` → `drawImage({x,y,width,height})` → `save()`.
- **Canvas** — `encodeCanvas`, `cropImage` from `src/tools/image/canvas.lib.ts`.
- **Color** — native `<input type="color">` (per `ImageWatermark.tsx`).
- **Download/preview** — `ResultActions` (PDF blob → download button) + `PdfPreview`.

## Architecture

### Pure lib — `src/tools/image/pas-foto.lib.ts` (framework-free, unit-tested)

- `CM_TO_PT = 28.3465`, `DPI = 300`.
- `PHOTO_SIZES: { id: '2x3'|'3x4'|'4x6'; w: number; h: number }[]` (cm; portrait, w<h).
- `SHEETS: { id: '4r'|'a4'; label: string; w: number; h: number }[]` — 4R = 10.16×15.24 cm, A4 = 21.0×29.7 cm.
- `photoPx(w_cm, h_cm, dpi=DPI): { w: number; h: number }` — pixel dimensions of one photo at print DPI. **Pure, tested.**
- `sheetLayout(photoW_cm, photoH_cm, sheetW_cm, sheetH_cm, gap_cm, margin_cm): { cols: number; rows: number; count: number; positions: { x: number; y: number }[] }` — grid fit; positions are top-left corners in cm from the sheet's top-left, centered as a block. **Pure, tested** (this is the core math).
- `cmToPt(cm: number): number`. **Pure, tested.**

### Island — `src/islands/image/PasFoto.tsx` (default export)

Steps, top to bottom:
1. `Dropzone` (single image) + `usePasteImage`.
2. **Background**: a "Remove background" toggle (on by default). When on, run `removeBackground` (determinate `ProgressBar`, "Downloading model…/Removing…"). Background color: red / blue / white preset swatches + native `<input type="color">` (default red `#e12729`-style; store hex).
3. **Size**: segmented buttons for 2×3 / 3×4 / 4×6.
4. **Framing**: a fixed-aspect preview box (target ratio) showing the recolored subject; **zoom** slider + **vertical position** slider so the face sits correctly. Compositing done on a hidden canvas: fill bg color, draw subject scaled/positioned, at `photoPx` resolution.
5. **Sheet**: segmented buttons 4R / A4.
6. **Generate**: build the single-photo PNG (canvas → `encodeCanvas('image/jpeg', 0.95)` — JPEG so white/солid bg prints clean and file stays small), then tile via `pdf-lib`: one page sized `cmToPt(sheet.w/h)`, `embedJpg` once, `drawImage` at each `sheetLayout` position (converted to PDF bottom-left origin), with a thin 0.5pt gray cut border per tile. Show `PdfPreview` + `ResultActions` (`pas-foto-<size>-<sheet>.pdf`).

i18n `TR: Record<Lang, {...}>` en + id (Bahasa: "tool" loanword, never "alat"). Signature `export default function PasFoto({ lang = 'en' }: { lang?: Lang })`. SSR-safe (all canvas/imgly work inside handlers/effects). ObjectURLs revoked; the compositing canvas is local to the handler.

### Registry — `src/registry/tools.ts`

```ts
{
  id: 'pas-foto',
  name: 'Pas Foto Maker',
  category: 'Image',
  route: '/tools/pas-foto',
  keywords: ['pas foto', 'pasfoto', 'id photo', 'passport photo', '2x3', '3x4', '4x6', 'foto ktp', 'print', 'background'],
  icon: IdCard,
  summary: 'Make print-ready 2x3, 3x4 & 4x6 ID photos with a clean background',
  load: () => import('@/islands/image/PasFoto'),
  status: 'beta'
},
```
Icon: verify `IdCard` / `UserSquare` / `Contact` exists in lucide; fall back to `Image`/`SquareUser`.

### SEO — `src/registry/tool-seo.ts` (REQUIRED, both locales)

EN + ID `pas-foto` entries with `title`, `description`, `intro`, **`howTo`** (step instructions), `faqs`. Keyword targets: "pas foto 3x4 online", "buat pas foto", "pas foto 2x3 4x6", "ID photo maker", "foto KTP background merah/biru". Bahasa uses "tool" loanword.

### PWA precache — `astro.config.mjs`

The imgly model/wasm is served from `/models/imgly/` (outside hashed build output) and the ONNX wasm is already covered by the `**/ort-*.wasm` globIgnore — **no change needed** (same as `BackgroundRemove`). Confirm no new precache-size warning at build.

## Testing

`src/tools/image/pas-foto.lib.test.ts` — `photoPx` (each size → expected px at 300 DPI), `cmToPt`, `sheetLayout` (3×4 on 4R → 3×3=9; 3×4 on A4 → 6×6=36; positions within bounds, count = cols*rows, centered block). Island covered by build + manual smoke (imgly + canvas can't run in jsdom).

## Definition of done

Spec+plan committed · `pas-foto.lib.ts` unit-tested · EN + ID SEO with howTo · vitest + lint + build green · `/tools/pas-foto` + `/id/tools/pas-foto` built · merged to develop · promoted to main · Cloudflare prod build green · live URL verified · user told about PWA hard-refresh.
