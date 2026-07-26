# Image Tools & Annotator Handoff — Design

**Status:** Approved (2026-07-25)
**Scope:** Spec A of a two-spec initiative. Spec B is the DB Diagram tool.

## Goal

Add three image tools and a cross-tool "send image to the annotator" capability:
1. **SVG Viewer & Converter** — view an SVG and rasterize it to PNG/JPEG/WebP.
2. **Image Viewer & Metadata** — a general image viewer (incl. multi-size ICO) with metadata.
3. **Monochrome** — convert an image to Grayscale, Black & White (threshold), or Dithered B/W.
4. **Annotator handoff** — an "Edit in Annotator" action on every image-producing tool that opens the Image Annotator with that image pre-loaded.

## Architecture

Everything is client-side, following existing patterns (Astro island per tool, `ToolDef` in `src/registry/tools.ts`, pure logic in `src/tools/image/*.lib.ts`, output via the shared `ImageResult`/`ResultActions` components). No new runtime dependencies. Cross-tool image transfer uses IndexedDB (the `idb` dep, as the Whiteboard already does) because Astro navigation is a full page reload and images exceed the `localStorage` quota.

**Tech stack:** existing — React islands, `canvas` 2D, `idb`, self-hosted Monaco (already used by playground tools), lucide icons.

## Global Constraints

- **Zero external network requests at runtime** — no CDNs; everything bundled/self-hosted.
- **All processing client-side** — no uploads.
- Follow existing tool conventions exactly (registry entry shape, island default-export with no required props, `ImageResult`/`ResultActions` for outputs, `usePasteImage` for paste, `Dropzone` for upload).
- New pure logic lives in `src/tools/image/*.lib.ts` and is unit-tested with Vitest.

---

## Component 1: Annotator handoff (the shared enabler)

### `src/services/handoff.ts` (new)
An IndexedDB-backed one-shot image channel.

- DB `gwt-handoff`, object store `image`, key `pending`. Value: `{ blob: Blob, name: string, ts: number }`.
- `export async function putPendingImage(blob: Blob, name: string): Promise<void>` — clears then writes the record.
- `export async function takePendingImage(maxAgeMs = 60000): Promise<{ blob: Blob; name: string } | null>` — reads, deletes, and returns the record; returns `null` if absent or older than `maxAgeMs`.
- `export async function sendImageToAnnotator(blob: Blob, name = 'image.png'): Promise<void>` — `await putPendingImage(...)` then `window.location.href = '/tools/image-annotate'`.

Interface — Consumes: nothing. Produces: `sendImageToAnnotator`, `takePendingImage`.

### `src/components/ui/EditInAnnotatorButton.tsx` (new)
- Props: `{ blob: Blob | (() => Blob | Promise<Blob>); filename?: string; className?: string }`.
- Renders a `<Button variant="secondary">` with a `PenTool`/`Wand2` lucide icon labeled "Edit in Annotator". On click: resolve the blob (supports lazy thunk like `CopyImageButton`), `await sendImageToAnnotator(blob, filename)`.
- Only renders when `blob.type` starts with `image/` (skip for non-image results). For a thunk it renders unconditionally.

### `src/islands/image/ImageAnnotate.tsx` (modify)
Add a mount-time effect that loads a pending handoff image as the **base** image:
```tsx
useEffect(() => {
  takePendingImage().then((pending) => {
    if (pending) onDrop([new File([pending.blob], pending.name, { type: pending.blob.type })]);
  });
}, []);
```
Placed after `onDrop` is defined. No other behavior changes; if there's no pending image the tool behaves exactly as today.

### Wiring the button across tools
- **`src/components/ui/ResultActions.tsx` (modify):** add `<EditInAnnotatorButton blob={blob} filename={filename} />` after the Copy button, gated on `blob.type.startsWith('image/')`. This automatically covers every tool using `ImageResult`: Image Converter, Compressor, Resizer, Cropper, Watermark, Merge, Metadata Scrubber, plus the two new viewer/mono tools.
- **Hand-wired tools (modify each):** add the button next to their existing Download/Copy actions — `Screenshot.tsx`, `BackgroundRemove.tsx`, `FaceBlur.tsx`, `PortraitBlur.tsx`, `ObjectRemove.tsx`, `ImageUpscale.tsx`, `QrGen.tsx` (PNG output only), `PdfToImage.tsx` (per-page), `SignaturePad.tsx` (PNG output).
- The Image Annotator itself does not get the button (it *is* the annotator).

**Error handling:** if `takePendingImage`/`putPendingImage` throws (private-mode IndexedDB, quota), catch and no-op — the button falls back silently (the user still has Download/Copy). Handoff is best-effort.

---

## Component 2: SVG Viewer & Converter

**Island:** `src/islands/image/SvgViewer.tsx` · **Lib:** `src/tools/image/svg.lib.ts` · **Route:** `/tools/svg-viewer` · **Category:** Image

### Input paths
- Upload/drag an `.svg` (Dropzone, `accept="image/svg+xml,.svg"`).
- Paste raw SVG markup into a Monaco editor pane (lazy-loaded like the playground) with live render on change.
- Paste an SVG file from clipboard (`usePasteImage` handles image files; for SVG-as-text, also read `text/plain` clipboard containing `<svg`).

### View
- Render the SVG in a checkerboard-backed pane (blob URL `<img>` or `dangerouslySetInnerHTML` of sanitized markup — sanitize with the existing `dompurify` dep, `USE_PROFILES: { svg: true, svgFilters: true }`).
- Zoom controls (buttons + wheel): 25%–800%, plus "fit". Pan by drag when zoomed.
- Show intrinsic width/height and `viewBox` parsed from the markup.

### Rasterize (`svg.lib.ts`)
- `parseSvgSize(markup): { width: number; height: number; viewBox?: [number,number,number,number] }` — pure; reads `width`/`height`/`viewBox` attributes (fallback 300×150 per SVG spec).
- `rasterizeSvg(markup: string, opts: { scale?: number; width?: number; height?: number; type: 'image/png'|'image/jpeg'|'image/webp'; quality?: number; background?: string }): Promise<Blob>` — loads the SVG as an `<img>` (data URL), draws to a canvas at the target size (scale multiplier or explicit W×H; JPEG/opaque fill white or `background`), encodes with `canvas.toBlob`. Reuses `canvas.lib.ts` encoding conventions.
- UI: export panel — format (PNG/JPEG/WebP), scale (1×/2×/4×) or explicit W×H, quality slider for JPEG/WebP. Output via `ImageResult` (gets Download/Copy/**Edit in Annotator** for free).

**Error handling:** invalid SVG → inline error under the input; malformed markup that fails to load as an image → "Couldn't render this SVG." Sanitization strips scripts/event handlers.

**Tests (`svg.lib.test.ts`):** `parseSvgSize` for width/height, viewBox-only, unitful values, missing (default 300×150); `rasterizeSvg` output dimensions for scale and explicit W×H, and that output MIME matches requested type (using a tiny inline SVG in jsdom with a canvas polyfill — dimension math is the assertion, not pixel content).

---

## Component 3: Image Viewer & Metadata

**Island:** `src/islands/image/ImageViewer.tsx` · **Lib:** reuse + `src/tools/image/ico.lib.ts` · **Route:** `/tools/image-viewer` · **Category:** Image

### Behavior
- Load any image (upload/drag/paste). Zoom/pan viewer (same controls as SVG viewer — extract a shared `<ZoomPane>` component in `src/components/ui/ZoomPane.tsx` used by both viewers).
- Metadata panel: file name, MIME type, byte size (`formatBytes`), intrinsic dimensions, and — when present — EXIF summary (orientation, camera, GPS-present flag). EXIF parsed with a tiny inline reader in `src/tools/image/exif.lib.ts` (pure, no dep — parse the APP1 header for a handful of common tags; if absent, show "No EXIF metadata").
- **ICO handling:** when the file is `image/x-icon`/`image/vnd.microsoft.icon` or `.ico`, parse the ICO directory (`ico.lib.ts` → `parseIcoEntries(buffer): { width, height, bpp, offset, size }[]`), list each embedded size, let the user pick one to preview and **export that size as PNG** (decode the selected entry — most ICO entries are PNG or BMP; support PNG entries directly, BMP entries via canvas).
- Actions: "Convert" (link to `/tools/image-convert`), Download, **Edit in Annotator** (via handoff, passing the current image blob).

**Tests:** `ico.lib.test.ts` — `parseIcoEntries` against a fixture buffer (assert entry count + sizes). `exif.lib.test.ts` — orientation tag parse from a minimal APP1 fixture; empty buffer → `null`.

---

## Component 4: Monochrome

**Island:** `src/islands/image/Monochrome.tsx` · **Lib:** `src/tools/image/mono.lib.ts` · **Route:** `/tools/monochrome` · **Category:** Image

### Modes (radio)
- **Grayscale** — luminance desaturate (`0.299R + 0.587G + 0.114B`).
- **Black & White** — threshold: pixel → black or white by comparing luminance to a `threshold` slider (0–255, default 128).
- **Dithered B/W** — Floyd–Steinberg error diffusion to 1-bit, for smoother tone.

### Lib (`mono.lib.ts`, pure, operate on `ImageData`)
- `toGrayscale(data: ImageData): ImageData`
- `toBlackWhite(data: ImageData, threshold: number): ImageData`
- `toDitheredBW(data: ImageData): ImageData` (Floyd–Steinberg)
- `applyMono(file: File, opts: { mode: 'grayscale'|'bw'|'dither'; threshold?: number }): Promise<Blob>` — decode → canvas → `getImageData` → mode fn → `putImageData` → `canvas.toBlob('image/png')`.

### UI
- Upload/drag/paste, mode radio, threshold slider (shown only for B&W mode), live preview (debounced), export PNG via `ImageResult` (Download/Copy/**Edit in Annotator**).

**Tests (`mono.lib.test.ts`):** on a 2×2 `ImageData` fixture — `toGrayscale` produces equal R=G=B per pixel; `toBlackWhite` yields only 0/255 with a threshold boundary check; `toDitheredBW` yields only 0/255 and preserves dimensions.

---

## Registry additions (`src/registry/tools.ts`)

Three new `ToolDef` entries (Category `Image`, `status: 'stable'`, routes `/tools/svg-viewer`, `/tools/image-viewer`, `/tools/monochrome`), with lucide icons (e.g. `FileImage`, `Eye`, `Contrast`) and keyword lists. No route/page changes needed — `[tool].astro` + `ToolHost` handle everything from the registry.

## File Structure

```
src/services/handoff.ts                         (new)
src/components/ui/EditInAnnotatorButton.tsx     (new)
src/components/ui/ZoomPane.tsx                   (new, shared by viewers)
src/components/ui/ResultActions.tsx             (modify: add handoff button)
src/islands/image/ImageAnnotate.tsx             (modify: mount-time handoff load)
src/islands/image/SvgViewer.tsx                 (new)
src/islands/image/ImageViewer.tsx               (new)
src/islands/image/Monochrome.tsx                (new)
src/tools/image/svg.lib.ts (+ .test.ts)         (new)
src/tools/image/ico.lib.ts (+ .test.ts)         (new)
src/tools/image/exif.lib.ts (+ .test.ts)        (new)
src/tools/image/mono.lib.ts (+ .test.ts)        (new)
src/registry/tools.ts                            (modify: 3 entries)
# modify (add handoff button): Screenshot, BackgroundRemove, FaceBlur,
# PortraitBlur, ObjectRemove, ImageUpscale, QrGen, PdfToImage, SignaturePad
```

## Testing strategy

Unit-test all pure lib functions (svg sizing/raster dims, ico parse, exif parse, mono transforms, handoff store round-trip against a fake-indexeddb or the jsdom shim). Island UI verified manually. Target: all existing tests stay green + new lib tests pass.
