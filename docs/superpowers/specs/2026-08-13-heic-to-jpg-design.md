# HEIC → JPG Converter — Design

**Date:** 2026-08-13
**Category:** Image
**Tool id:** `image-heic-to-jpg`

## Goal

Let anyone convert Apple HEIC/HEIF photos to JPG entirely in the browser — no upload, no server. Solves the ubiquitous "every iPhone photo is HEIC and Windows/web apps can't open it" wall.

## Why it fits GWT

100% client-side. HEIC is decoded with libheif compiled to wasm (via the `heic-to` package, which inlines the libheif wasm), then re-encoded to JPEG. Nothing leaves the device — consistent with the privacy-first promise.

## Scope (confirmed with user)

- **Batch input + ZIP output.** Drop many HEIC files at once; download each JPG individually or all as one ZIP.
- **JPG output with a quality slider** (0.5–1.0, default 0.92).
- Per-file failures surface as a warning without aborting the rest of the batch.

## Library choice

**`heic-to` (v1.5.2)** — modern ESM wrapper around libheif-wasm. `heicTo({ blob, type: 'image/jpeg', quality })` decodes HEIC and returns a JPEG `Blob` in one call. The libheif wasm is inlined (base64) in the JS chunk, so there is no separate `.wasm` asset to host under `public/models/`. Dynamic-imported inside the lib so it never bloats the island chunk; its emitted chunk is added to `workbox.globIgnores`.

Fallback if `heic-to` misbehaves at runtime: `heic2any` (same wasm-inlined approach, older). Decided at build time, not shipped as a runtime toggle.

## Architecture

Mirrors the existing `image-convert` tool.

### Pure lib — `src/tools/image/heic.lib.ts`

- `isLikelyHeic(file: { name: string; type: string }): boolean` — **pure, unit-tested.** Browsers frequently report an empty or generic MIME type for HEIC, so detection is by extension (`.heic`, `.heif`, case-insensitive) OR by a recognized MIME (`image/heic`, `image/heif`, `image/heic-sequence`, `image/heif-sequence`).
- `jpegName(originalName: string): string` — **pure, unit-tested.** Replaces the final extension with `.jpg`; appends `.jpg` when there is no extension.
- `heicToJpeg(file: File, quality: number): Promise<Blob>` — thin wrapper. `const { heicTo } = await import('heic-to');` then `return heicTo({ blob: file, type: 'image/jpeg', quality })`. Not unit-tested (needs real wasm decode); covered by manual smoke.

### Island — `src/islands/image/HeicToJpg.tsx` (default export)

- `Dropzone` with `multiple` — accepts a batch. Filters kept files through `isLikelyHeic`; files that fail the filter are reported (`Alert`) but ignored.
- Quality slider (range input, 0.5–1.0 step 0.01).
- "Convert" runs each file through `heicToJpeg`, accumulating `{ name, blob }` results and `{ name, message }` errors. Indeterminate work → plain busy line + count (`Converting 3 of 12…`), **not** `ProgressBar` (which is determinate-only). Actually we can show determinate progress since we know the total — use a simple "n of N" text; `ProgressBar` with `percent` is acceptable too. Use `ProgressBar` with `percent = done/total*100`.
- Results: one `ImageResult` per converted file (preview + individual download), plus a "Download all as ZIP" button (`ResultActions` / `downloadService`) built from `createZip` (`src/tools/files/zip.lib.ts`).
- i18n `TR: Record<Lang, {...}>` with `en` + `id`, selected by `lang` prop. Signature `export default function HeicToJpg({ lang = 'en' }: { lang?: Lang })`.
- SSR-safe: no `window`/`document` at module scope.

### Registry — `src/registry/tools.ts`

```ts
{
  id: 'image-heic-to-jpg',
  name: 'HEIC to JPG',
  category: 'Image',
  route: '/tools/image-heic-to-jpg',
  keywords: ['heic', 'heif', 'jpg', 'jpeg', 'convert', 'iphone', 'photo', 'apple'],
  icon: ImageDown,
  summary: 'Convert iPhone HEIC/HEIF photos to JPG',
  load: () => import('@/islands/image/HeicToJpg'),
  status: 'beta'
},
```
`ImageDown` imported from `lucide-react` at the top of `tools.ts`.

### SEO — `src/registry/tool-seo.ts`

Add `image-heic-to-jpg` to both the EN block (~line 693 area) and the ID block (~line 2200 area). Fields: `title`, `description`, `intro`, `howTo` (string[]), `faqs` (`{q,a}[]`). Keyword targets: "HEIC to JPG", "convert iPhone photos", "open HEIC on Windows", "HEIC viewer". Bahasa uses the "tool" loanword, never "alat".

### PWA precache — `astro.config.mjs`

Add to `workbox.globIgnores`: `'**/heic-to*.js'` and `'**/libheif*.js'` (whichever chunk names the decoder emits) so the heavy wasm-carrying chunk stays out of the precache.

## Testing

- `src/tools/image/heic.lib.test.ts` — table-driven (`it.each`) over `isLikelyHeic` (extensions, MIME variants, negatives like `.jpg`/`.png`) and `jpegName` (has-ext, no-ext, uppercase ext, dotted names).
- Island covered by build + manual smoke (real HEIC decode can't run in jsdom).

## Definition of done

Spec+plan committed · `heic.lib.ts` unit-tested · vitest + lint + build green · new `/tools/image-heic-to-jpg` page builds · merged to develop · promoted to main · Cloudflare prod build green · live URL verified · user told about PWA hard-refresh.
