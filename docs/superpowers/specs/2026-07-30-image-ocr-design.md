# Image → Text (OCR) — Design Spec

**Status:** Approved (brainstorming complete)
**Date:** 2026-07-30
**Author:** brainstormed with Kresna
**Scope:** Phase 1 (English-only MVP). Structured receipt parsing, multi-language, and batch input are explicitly deferred to later phases.

## Goal

Add a client-side **Image → Text (OCR)** tool to GoodWebTools that extracts raw text from an uploaded image or PDF entirely on-device. Receipts are the motivating use case, but the tool is a general OCR utility. The uploaded document never leaves the browser; only the OCR model files are fetched (from a CDN, cached thereafter).

## Motivation & Context

Users want to pull text out of receipts, screenshots, and scanned documents without uploading them to a third-party service. GWT already ships heavy on-device WASM/ML tools (`onnxruntime-web`, `mupdf`, `upscaler`, `@tensorflow/tfjs`), so the infrastructure patterns for lazy-loaded WASM, worker inference, and PWA-precache exclusion already exist and will be reused.

## Locked Decisions

These were settled during brainstorming and are not open questions:

1. **Output:** raw recognized text (copy + download `.txt`). Structured field extraction (merchant/date/total/line items) is a **future phase**, not this spec.
2. **Language:** **English only** for the MVP. The architecture must leave a clean seam for a curated (~10-language) picker later.
3. **Engine:** the **PP-OCR pipeline (detection + angle-classification + recognition) running on ONNX Runtime Web**, via a maintained browser SDK (see Engine section). Chosen over Tesseract.js for higher accuracy on messy/real-world images ("the most powerful one").
4. **Input:** a **single image** (PNG/JPG/WebP, via upload / drag-drop / paste) **or a PDF** (rasterized via the existing mupdf pipeline; multi-page PDFs get page selection).
5. **Preprocessing:** a **"review & adjust" step** before OCR. Light auto-cleanup is available but **off by default** (PP-OCR is trained on natural images; aggressive binarizing can *reduce* accuracy). Manual overrides: rotate, crop, threshold slider.
6. **Model hosting:** language/model files are **fetched from a CDN on demand** and cached. The image itself never leaves the browser; the UI discloses the one-time model download.
7. **Error messages:** every failure/degradation surfaces its **specific reason** (see Error Handling).

## Engine

The OCR engine is a PP-OCR (PaddleOCR) pipeline running on **ONNX Runtime Web** (already a project dependency), with **WebGPU acceleration and automatic WASM fallback**. The full pipeline — image normalization, text **detection**, per-box crop/rectify, angle **classification**, text **recognition**, and CTC **decoding** — plus all post-processing is provided by the SDK; we do **not** hand-roll contour finding / polygon-unclip / perspective warp.

**Lead candidate:** [`ppu-paddle-ocr`](https://www.npmjs.com/package/ppu-paddle-ocr) (`/web` entry) — PP-OCRv5, ONNX Runtime Web, WebGPU→WASM auto-fallback, on-demand + cached model download, `initialize()/recognize()/destroy()` API.
**Alternatives with the same shape:** official [`@paddleocr/paddleocr-js`](https://www.npmjs.com/package/@paddleocr/paddleocr-js), [`@gutenye/ocr`](https://github.com/gutenye/ocr).

**Engine-agnostic design:** all candidates share the `init → recognize(canvas) → { text, boxes }` shape. The exact package + version is pinned in the **first implementation task** via a thin vertical-slice eval (recognize text on one canvas, confirm bundle/model sizes, WebGPU + WASM paths). If the lead candidate fails the eval, an alternative is substituted behind the same `ocr.lib` wrapper with no other code changes.

## Architecture

A new **Image**-category tool `image-ocr` ("Image to Text (OCR)"), lazy-loaded through the registry `load()` like other heavy tools. Business logic lives in small, isolated, unit-tested libs; the island is a thin orchestrator.

```
File/paste ─┐
PDF ────────┤→ [source → canvas]* → [Review & Adjust] → [ocr.lib.recognize] → [Results]
            │      *PDF rasterized      preprocess        SDK on ORT-web        text + copy
            │       via mupdf           (optional)        WebGPU/WASM           + download
```

### Components

| File | Responsibility | Depends on | Tested by |
|------|----------------|------------|-----------|
| `src/tools/image/ocr.lib.ts` | Sole contact point with the OCR SDK. Lazy cached `initEngine()`; `recognize(source) → { text, lines: [{ text, box, confidence }] }`; maps SDK/runtime failures to reason-specific `OcrError`s. | the OCR SDK (mocked in tests) | mock SDK: output mapping + each error path |
| `src/tools/image/ocr-preprocess.lib.ts` | Pure canvas transforms for the review step: grayscale, contrast/threshold (reuse `mono.lib` `toGrayscale`/`toBlackWhite`), rotate, crop. Input canvas → output canvas. | `mono.lib`, `canvas.lib` | deterministic pixel assertions (mirrors `mono.lib.test`) |
| `src/tools/image/ocr-pdf.lib.ts` | Thin adapter: PDF `File` + page index → canvas, using the same mupdf rasterization the `pdf-to-image` tool uses. Exposes page count for the picker. | existing mupdf client/worker (mocked) | mock mupdf: page count + rasterize call |
| `src/islands/image/ImageOcr.tsx` | Thin UI orchestrator: input (dropzone + `usePasteImage`), PDF page selection, review-&-adjust panel, run + progress, results (editable text, copy, download, optional overlay). | the three libs above | light island test / manual smoke |
| `src/registry/tools.ts` (edit) | Register `id: 'image-ocr'`, `category: 'Image'`, `route: '/tools/image-ocr'`, `status: 'beta'`, `keywords: ['ocr','receipt','scan','text','extract','recognize','read']`, `load: () => import('@/islands/image/ImageOcr')`. | — | build / registry render |
| `astro.config.mjs` (edit) | Add the ORT-wasm + OCR SDK chunk globs to workbox `globIgnores` so they are not PWA-precached (same treatment as DbDiagram/Monaco). | — | build (precache manifest) |
| route page `src/pages/tools/image-ocr.astro` | Standard tool route wrapper hosting the island (follow existing tool pages). | — | build |

### Data Model

```ts
interface OcrLine {
  text: string;
  box: { x: number; y: number; width: number; height: number }; // for optional overlay
  confidence: number; // 0..1
}
interface OcrResult {
  text: string;        // all lines joined in reading order (sorted top-to-bottom, then left-to-right)
  lines: OcrLine[];
}
class OcrError extends Error {
  reason: 'engine-unsupported' | 'model-download' | 'inference' | 'no-text' | 'input';
  // message is the user-facing, reason-specific string
}
```

## UX / Data Flow

1. **Input:** drag-drop / file-pick / paste (`usePasteImage`) an image, or pick a PDF. A PDF renders a page to canvas via `ocr-pdf.lib`; multi-page PDFs show a page selector.
2. **Review & Adjust panel:** live canvas preview with controls —
   - **"Clean up image" toggle** (grayscale + contrast/threshold), **off by default**.
   - **Rotate** (90° steps + fine).
   - **Crop** to the region of interest.
   - **Threshold slider** (only meaningful when cleanup is on).
3. **Run OCR:** button runs `ocr.lib.recognize()` on the adjusted canvas. A progress/indeterminate indicator shows while the engine initializes (first-run model download) and infers. Disclose on first run that models download once from a CDN and are then cached.
4. **Results:** recognized text in an **editable/selectable textarea**, with **Copy** and **Download .txt**. Empty result → "no text detected" guidance.
5. **Optional stretch (flagged, not MVP-blocking):** a bounding-box overlay on the preview using `lines[].box`.

## Error Handling (reason-specific)

A `reason → user message` map lives in `ocr.lib`. Every surfaced state states *why*:

- **WebGPU unavailable** → informational, not an error: *"Running in slower CPU (WASM) mode — WebGPU isn't available in this browser."* (OCR still works.)
- **Engine can't initialize at all** (e.g. no WASM SIMD) → *"On-device OCR couldn't start: this browser lacks WebAssembly SIMD, which the OCR engine requires."* (`reason: 'engine-unsupported'`)
- **Model download fails** (offline / CDN blocked) → *"Couldn't download the OCR model (network error or blocked). First use needs a connection — check it and Retry."* + Retry button. (`reason: 'model-download'`)
- **Inference throws** → surface the underlying reason text: *"OCR failed: &lt;engine message&gt;."* (`reason: 'inference'`)
- **Oversized image** → auto-downscaled to a max dimension before inference; note *"Large image downscaled to N px for processing."* (guard, not a hard error)
- **No text found** → *"No text detected — try turning on Clean up image, or use a clearer/tighter crop."* (`reason: 'no-text'`)
- **Unsupported file / broken PDF** → validation message naming the problem. (`reason: 'input'`)

## Testing

- **Unit (Vitest, following existing patterns):**
  - `ocr-preprocess.lib` — deterministic pixel assertions for grayscale/threshold/rotate/crop (mirrors `mono.lib.test`).
  - `ocr.lib` — mock the SDK; assert SDK output → `OcrResult` mapping, reading-order join, and each `OcrError` reason/message.
  - `ocr-pdf.lib` — mock mupdf; assert page-count read and rasterize invocation.
- **Not unit-tested:** real model inference (large, nondeterministic) — covered by a **manual smoke checklist** (English receipt, screenshot, multi-page PDF, WebGPU path, WASM-fallback path, offline model-download error). This mirrors how capture/hotkey/WASM services mock their heavy dependency in unit tests.
- Keep the island thin so coverage concentrates in the libs.

## Constraints & Non-Functional

- **Privacy:** the document never leaves the browser. Only model files are fetched (CDN, cached). UI discloses this.
- **Bundle/PWA:** ORT-wasm + SDK chunks excluded from workbox precache via `globIgnores`; models are runtime-fetched (optionally runtime-cached by the service worker for repeat/offline use).
- **Performance:** inference off the main thread (ORT-web workers); oversized inputs downscaled; progress surfaced.
- **Follows existing patterns:** registry `ToolDef` shape, `usePasteImage`, `mono.lib`/`canvas.lib`, mupdf rasterization, lazy `load()`.

## Out of Scope (future phases)

- Structured receipt fields (merchant, date, total, tax, line items).
- Multi-language picker (~10 curated languages + per-language rec models/dicts).
- Batch / multi-file OCR.
- Auto-deskew of the whole image (PP-OCR per-box rectification largely covers rotation).
- Self-hosting models for fully-offline first use.

## Open Implementation Detail (resolved in the plan, not blocking)

- Exact SDK package + version, and its model-hosting URLs, are pinned in the first implementation task's vertical-slice eval. The `ocr.lib` wrapper isolates this choice so a substitution touches one file.
