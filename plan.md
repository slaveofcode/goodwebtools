# GoodWebTools.com — Client-Side Utility Suite

A single site hosting privacy-first office/dev tools. **Every operation runs in the browser.** No file, image, or document is ever uploaded to a server. The only network traffic after page load is the one-time download of WASM binaries and ML models from a pinned CDN (cached forever afterward).

This document is the implementation spec. It's written to be handed to a coding agent and executed phase by phase. Decision points that the human should confirm are marked **[DECISION]**.

---

## 1. Goals & Non-Goals

**Goals**
- One site, many tools, unified shell (nav, search/command palette, consistent UI).
- Truly client-side: all processing in-browser via WASM / WebCrypto / Canvas / Workers.
- Lazy everything: initial load stays light; each tool's heavy deps load only when opened.
- Works offline as a PWA — which is also the strongest proof of the privacy claim.
- Fast enough for daily office use; large-file safe (streaming, OPFS, workers).

**Non-Goals**
- No accounts, no backend, no analytics that transmit file contents.
- No server-side rendering of user data (the app can be statically hosted).
- Not trying to beat desktop apps on the heaviest workloads (e.g. 4K video) — "good enough in the browser" is the bar.

---

## 2. Core Principles

1. **No egress of user data.** Enforced by a strict CSP `connect-src` allowlist (self + the single model/WASM CDN). Users can verify in DevTools → Network. Document this prominently.
2. **UI thread stays free.** All CPU-heavy work (PDF, image ML, ffmpeg, hashing large files) runs in Web Workers. WASM is instantiated inside the worker, not the main thread.
3. **Load on demand.** Route-level code splitting + dynamic `import()` for each tool. WASM/model assets fetched on first use of that specific tool.
4. **Cache aggressively.** WASM binaries and ML models cached in the Cache API / IndexedDB so first-use cost is paid once.
5. **Degrade gracefully.** Feature-detect File System Access API, OPFS, SharedArrayBuffer; fall back to `<input type=file>` + blob downloads when unavailable.

---

## 3. Tech Stack

Resolved: **Astro shell + React islands, static output, hosted on Cloudflare Pages, open-source on GitHub.** (Framework decision made — see rationale note.)

| Concern | Choice | Notes |
|---|---|---|
| Meta-framework | **Astro** (`output: 'static'`) | Islands architecture: static HTML by default, hydrate only interactive tools. Per-page code-splitting for free. Uses Vite under the hood, so WASM/worker ergonomics are intact. |
| Interactive UI | **React 18 islands** (`@astrojs/react`) | Chosen over Vue for concrete ecosystem fit: Excalidraw/tldraw are React-only, Monaco's best wrapper is React, most WASM/ONNX demos are React. |
| Styling | **Tailwind CSS** (`@astrojs/tailwind`) | Fast, consistent, tree-shaken. |
| Routing | **Astro file-based pages** + View Transitions (`<ClientRouter />`) | Each tool = its own page/route → only that tool's island + deps load. `transition:persist` keeps the shell (command palette, worker pool) alive across navigations. |
| State | Zustand or React Context (per-island) | Most state is per-tool local; shell state lives in a persisted island. |
| Workers | **Comlink** | Ergonomic worker RPC, hides postMessage plumbing. Framework-agnostic. |
| PWA/offline | **`@vite-pwa/astro`** (Workbox) | Precache shell; runtime-cache WASM/models. Offline = the privacy proof. |
| Icons | lucide-react | Matches the tool-card aesthetic. |
| Hosting | **Cloudflare Pages** (static) | GitHub-integrated CI/CD auto-deploy. `_headers` file sets COOP/COEP + CSP site-wide. Large model/WASM files optionally on **R2** (same-origin friendly). |
| Repo | **Public GitHub** | Open source for verifiability; deploy from `main`, link the exact commit in the footer. |

> **Why Astro fits:** a tools site is mostly static surface (home, per-tool landing/SEO pages, privacy/docs) with pockets of heavy interactivity. Astro ships **zero JS** on the static surface and hydrates each tool as an island only when its page loads — which *is* the "lazy-load each tool" goal, handled natively by per-page islands rather than hand-rolled route splitting. App-like tools (editor, PDF editor) are simply a full-page island; you keep Astro's benefits everywhere else.
>
> **The one Astro-specific design point [DECISION]:** it's MPA by default, so a persistent ⌘K command palette and a long-lived WorkerPool need Astro **View Transitions + `transition:persist`** to survive navigation — otherwise they re-init per page. Alternative is mounting the whole app as a single SPA-style React island inside one Astro layout, but that forfeits Astro's per-page JS savings. Recommended: MPA + persisted shell islands.
>
> **Vue note:** `@astrojs/vue` is equally mature in the abstract and matches your Nuxt 4 background, but you'd fight the React-only whiteboard/diagram libs. Only revisit if you drop Excalidraw/tldraw.

**Cross-origin isolation:** ffmpeg.wasm (multithreaded) and some ONNX threading need `SharedArrayBuffer`, which requires the page to be cross-origin isolated via `COOP: same-origin` and `COEP: require-corp` (or `credentialless`). On Cloudflare Pages, set these in `_headers`. Any cross-origin CDN assets must then send CORP headers or be fetched `crossorigin` — self-hosting WASM/models on the same origin (or R2 with proper headers) sidesteps this. **Get headers right in Phase 0** — it's the single most common gotcha here.

---

## 4. Architecture

Astro renders static pages; interactive tools are React islands. A persisted shell island (nav + ⌘K palette + worker pool) survives navigation via View Transitions.

```
┌────────────────────────────────────────────────────┐
│  Astro static pages  (zero JS by default)           │
│  home · /tools/* landing+SEO · /privacy · /docs     │
└───────────────┬──────────────────────────────────────┘
                │ hydrates
      ┌─────────▼───────────────────────────┐
      │  Persisted Shell Island (transition:persist)  │
      │  • nav, command palette (⌘K), tool registry    │
      │  • Shared services: FileService, WorkerPool,   │
      │    AssetCache, DownloadService, Toast/Progress │
      └─────────┬───────────────────────────┘
                │ per-tool page island (lazy, per-page)
      ┌─────────▼──────────┐
      │  Tool Island        │  page: /tools/pdf-merge
      │  • React view       │
      │  • useWorker() hook  │
      └─────────┬──────────┘
                │ Comlink RPC
      ┌─────────▼──────────┐
      │  Web Worker         │
      │  • instantiate WASM  │
      │  • do the work       │
      │  • stream progress   │
      └────────────────────┘
```

### 4.1 Tool Registry (the heart of the shell)
A single typed manifest drives nav, search, the command palette, and per-tool asset hints. Each entry maps to an Astro page route; `load` dynamic-imports the island component for that tool.

```ts
interface ToolDef {
  id: string;                 // 'pdf-merge'
  name: string;               // 'Merge PDF'
  category: Category;         // 'PDF' | 'Image' | 'Files' | 'Draw' | 'Dev' | 'Media'
  route: string;              // '/tools/pdf-merge'  (Astro page)
  keywords: string[];         // for search/command palette
  icon: LucideIcon;
  summary: string;
  load: () => Promise<{ default: React.ComponentType }>; // island dynamic import
  needsIsolation?: boolean;   // requires COOP/COEP (ffmpeg multithread)
  needsExtension?: boolean;   // enhanced-only capability (see §6)
  assets?: AssetRef[];        // wasm/model URLs + sizes for preflight + cache
  status: 'stable' | 'beta' | 'experimental';
}
```

### 4.2 Shared services
- **FileService** — normalizes input across drag-drop, `<input>`, File System Access API, and clipboard paste. Provides `File`/`Blob`/streaming handles. Uses **OPFS** for scratch space on large files.
- **WorkerPool** — spins up/reuses workers per tool family; terminates on route-away to free memory. Concurrency capped by `navigator.hardwareConcurrency`.
- **AssetCache** — fetches WASM/models once, stores in Cache API (WASM) / IndexedDB (models), returns cached bytes with progress events. Integrity-pin with SRI hashes.
- **DownloadService** — Blob → download; uses File System Access `showSaveFilePicker` when available for "save as".
- **Progress/Toast** — unified progress bars fed by worker events.

### 4.3 Directory layout (Astro conventions)
```
src/
  pages/                 # Astro routes → static HTML
    index.astro          # home / tool grid
    privacy.astro        # "verify it yourself" page
    tools/
      [tool].astro       # or explicit files per tool; mounts the island
  layouts/
    Base.astro           # <head>, ClientRouter (view transitions), shell slot
  components/
    shell/               # ShellIsland.tsx (persisted): nav + ⌘K palette
    ui/                  # Dropzone, ProgressBar, FileList, ResultActions (React)
  islands/               # per-tool React entry components (lazy)
    pdf/ image/ files/ draw/ dev/ media/
  tools/                 # framework-agnostic logic
    pdf/merge/ { lib.ts, worker.ts }   # pure logic + worker per tool
    ...
  registry/              # tools.ts manifest + categories
  services/              # file, workerPool, assetCache, download, crypto
  workers/               # shared worker entries per family
public/
  wasm/                  # self-hosted wasm (same-origin → simpler COEP)
  models/                # or serve large models from Cloudflare R2
_headers                 # Cloudflare Pages: COOP/COEP + CSP + SRI-friendly
astro.config.mjs         # integrations: react, tailwind, pwa
```

> **Verifiability (open source):** the site is static + fully client-side + offline-capable, so anyone can `git clone`, `npm run build`, and diff the output against what Cloudflare serves — or just run it locally. Strengthen trust with: exact deploy commit linked in the footer, SRI hashes on any remote assets, a strict CSP (below), and reproducible-build notes in the README. Cloudflare Pages build logs are public-adjacent via the GitHub Actions/CI you configure.

---

## 5. Tools & Libraries (implementation reference)

Grouped by family. Each family shares a worker + patterns.

### PDF (`pdf-lib`, `pdf.js`, optionally `mupdf`/wasm)
- Merge, split, reorder, rotate, delete pages — `pdf-lib`.
- Render/preview pages, thumbnails, PDF→image — `pdf.js`.
- Images→PDF — `pdf-lib`.
- Password protect / remove (user + owner) — `pdf-lib` (encryption) or `mupdf` if stronger crypto needed. **[DECISION]** on library for encryption strength.
- Compress (downsample embedded images) — `pdf.js` extract + re-encode via canvas/`squoosh`.
- Watermark (text/image, opacity, tiled/diagonal) — `pdf-lib`.
- Annotate / text boxes / signature / form fill — `pdf-lib` + custom canvas overlay.
- **Redaction (true removal)** — rasterize page region or rebuild content stream; never just draw a black box. High-value, flag complexity.
- OCR → searchable PDF — `tesseract.js` (WASM) to get text layer, merge with `pdf-lib`.

### Image (`squoosh` codecs, `onnxruntime-web`, Canvas/WebGL)

> **HD / full-resolution export — applies to every image tool below.** All edits are applied to a **full-resolution offscreen buffer** (`OffscreenCanvas` + `createImageBitmap` in a worker), never to the downscaled on-screen preview — the on-canvas view is scaled for display only, and export always renders from the native-resolution source. Output preserves the original pixel dimensions (no silent capping to viewport size). Export goes through the **high-quality Squoosh encoders** (MozJPEG / OxiPNG / WebP / AVIF) via a shared **Export panel**: pick format, quality (with lossless PNG and 4:4:4 JPEG for text-heavy images), and see an estimated size — not the low-quality default `canvas.toDataURL`. Respect EXIF orientation on load so exports aren't rotated; strip metadata on save. Two honest limits to handle gracefully: (1) browsers cap canvas dimensions/area (~16k px/side, lower on Safari), so for very large images **tile the operation** or warn + offer a max-quality downscale; (2) the 2D canvas pipeline is 8-bit sRGB, so 16-bit/HDR inputs flatten to 8-bit — fine for resolution ("HD"), but note it for pro workflows.

- Compressor — MozJPEG / OxiPNG / WebP / AVIF encoders (wasm). Essentially self-hosted Squoosh.
- Format convert — same codec set + HEIC decode (`libheif-wasm`).
- Resize / crop / batch — Canvas / `pica` for quality downscale.
- Watermark (batch, position grid, opacity) — Canvas.
- **EXIF / metadata scrubber** — strip GPS/device via re-encode or `piexifjs`. High privacy value; ship early.
- **Blur & auto-redact** — hide sensitive parts of a photo, single or **batch**, fully in-browser:
  - **Manual** — mask any area, then choose **Gaussian blur**, **pixelate/mosaic**, or **solid fill**. Mask **shapes**: freehand brush, **rectangle**, **rounded rectangle** (corner-radius slider), **ellipse/circle**, **polygon** (click vertices), and **lasso** (freehand closed path) — implemented as Canvas clip paths (`Path2D`) so the effect applies only inside the shape. Extras: rotate/resize each shape, optional **feathered/soft edge** so blur blends naturally, multiple independent regions per image, adjustable strength, undo/redo. Auto-detected regions (below) can also snap to **ellipse** (flatters faces) or rounded-rect instead of hard rectangles.
  - **Auto-detect faces** — one-click blur all faces via a browser detector (MediaPipe **BlazeFace** / **SCRFD** / **RetinaFace**) run through `onnxruntime-web` (WASM, WebGPU when available). Reliable; each detection is an editable region you can add/remove before applying.
  - **Auto-detect license plates** — dedicated plate-detection ONNX model (YOLO-family). Detection-only (no OCR needed to blur). Less bulletproof than faces — accuracy varies with angle/lighting/region — so results are editable and manual touch-up is encouraged.
  - **Auto-detect text** *(bonus)* — text-detection model (EAST/DBNet/PaddleOCR-det) to scrub names/addresses from documents & screenshots.
  - **General objects** *(optional)* — YOLO COCO detector for classes like person/car/screen.
  - **Security-honest defaults** — because light blur and pixelated *text* can be partially reversed (depixelation attacks), the privacy-grade mode is **solid fill** and it's the default for text/plates; the UI warns when a weak mode is chosen for sensitive content. **Always re-encode + strip EXIF on export** so nothing leaks via the file or metadata. Detection runs in a worker; models cached in IndexedDB; images never leave the device. *(Video face-blur is a possible later extension — much heavier: per-frame detection + ffmpeg.)*
- Background eraser — **U²-Net / MODNet / RMBG** ONNX via `onnxruntime-web` (WASM/WebGPU). *Model 5–150MB, cached.*
- Object remover — **LaMa** inpainting ONNX. Mask via brush canvas. *Heavy.*
- Upscaler — **Real-ESRGAN** ONNX. *Heavy; WebGPU strongly preferred.*
- Extras: color palette extractor, favicon generator, SVG optimizer (`svgo` browser build).

### Files & Archives (`fflate`, `zip.js`, `7z-wasm`, WebCrypto)
- Zip **with AES-256 password** — `@zip.js/zip.js` (supports AES).
- Extract 7z / rar / tar / gz — `7z-wasm` (single tool covers many formats).
- File encrypt/decrypt with password — **WebCrypto AES-GCM** + PBKDF2/Argon2 key derivation. **[DECISION]** Argon2 (via wasm) recommended over PBKDF2 for password strength; define file format header (salt, iv, kdf params, version).
- Hash generator — SHA-256/512 via WebCrypto; MD5/SHA-1 via small wasm/js (streamed for big files).
- Large-file split/join — stream slices to OPFS.

### Draw & Diagram (Canvas/WebGL — mostly JS, little/no WASM)
- Whiteboard / sketch — **embed Excalidraw** (`@excalidraw/excalidraw`) or build a lighter custom canvas. **[DECISION]** embed vs. build.
- Flowchart / diagram, mind map, wireframe — could layer on Excalidraw or `tldraw`.
- Signature pad — `signature_pad`, exports transparent PNG/SVG (feeds PDF signing).

### Dev / Office utilities (pure JS — trivially client-side, ship first)
JSON format/validate/tree, YAML↔JSON↔TOML, CSV↔JSON, CSV viewer, Markdown editor+preview+export, text diff, Base64/URL/JWT decode, regex tester, QR generate **and read** (`jsQR`/`qr-scanner`), barcode, password generator, UUID generator (v4–v7), epoch converter, timezone translator, cron builder/translator, color converter, code formatters/minifiers (`prettier` standalone).

- **Multi-cursor text editor / line wrangler** — a VS Code-grade editing scratchpad for bulk text manipulation, built on **Monaco** (the same editor engine VS Code uses) so the *exact* muscle memory carries over:
  - **Multi-cursor & column editing** — add cursor above/below (`⌘/Ctrl+Alt+↑/↓`), add cursor at all occurrences (`⌘/Ctrl+Shift+L`), select-next-occurrence (`⌘/Ctrl+D`), and **column/box selection** (`Shift+Alt+drag`) to insert/replace characters at the same position across many lines at once — the core behavior you asked for, native to Monaco.
  - **Keymap parity** — ships VS Code keybindings by default; optional Vim/Emacs keymaps for people who want them. A discoverable shortcut cheatsheet panel since these are the whole point.
  - **Batch line operations toolbar** — the transforms people *reach for* multi-cursor to do, but faster and repeatable: prefix/suffix every line, wrap each line (quotes/brackets), add/strip line numbers, sort (asc/desc/natural/by-column), dedupe, remove blank lines, trim whitespace, reverse, join-with-delimiter / split-by-delimiter, case transforms (UPPER/lower/Title/camelCase/snake_case/kebab-case), extract columns by delimiter, and **insert an incrementing number sequence** across cursors (start/step configurable).
  - **Regex find/replace** — multiline, with capture-group references (`$1`) and per-line or whole-buffer scope; live match highlighting.
  - **Why it's worth building** (not just "use VS Code"): zero install / instant, safe for pasting sensitive text (never leaves the machine), and the batch toolbar beats manual multi-cursor for structured bulk edits. Pure client-side, no WASM.
- **UUID generator (v4 → v7)** — generate single or bulk UUIDs across versions, with copy/export. Powered by the `uuid` package (v10+ supports v6/v7). Versions:
  - **v4** — random. The default general-purpose ID; generate-on-click, no inputs.
  - **v5** — name-based (SHA-1 namespace hashing). Deterministic: same namespace + name always yields the same UUID. UI needs a namespace UUID (with DNS/URL/OID/X.500 presets) + a name string.
  - **v6** — v1 reordered to be time-ordered (field-compatible with v1 but sortable). Timestamp-based; useful when migrating from v1 while gaining index locality.
  - **v7** — Unix-epoch-millisecond timestamp + random tail. **Recommended for new time-ordered IDs** (sortable, index-friendly primary keys) per RFC 9562. Offer options for monotonic counter within the same millisecond.
  - UX: version tabs, bulk count field, uppercase/hyphenless/braces toggles, and a note that v4/v7 are the two most people actually want (v4 = random, v7 = sortable).
- **Timezone translator** — convert a time across zones:
  - **Input** — paste a time that already carries a zone/offset (e.g. `2026-07-11 14:30 +07:00`, `2026-07-11T14:30:00Z`, or `3:00 PM WIB`) and it parses the source zone automatically; or enter a bare time and **pick the source timezone** from a searchable IANA list.
  - **Output** — see the converted time in **UTC and any number of target zones at once** (add/remove rows, e.g. Asia/Jakarta, UTC, America/New_York, Europe/London), each showing the offset and abbreviation.
  - **DST-correct** — resolve offsets from the IANA tz database for the actual date, not a fixed offset, so daylight-saving shifts and historical changes are handled right. Flag ambiguous/nonexistent local times (the DST fall-back/spring-forward edge cases).
  - **Handy extras** — "now" button, epoch (seconds/ms) ↔ datetime, relative delta between two zoned times, copy in ISO 8601 / RFC 3339 / locale formats, and a compact "meeting across zones" view. Powered by `Luxon` or `Temporal` (with polyfill) — never floating-offset math.
- **Cron pattern translator** — bidirectional cron tool:
  - **Cron → plain English** — paste an expression, get a readable explanation ("At 02:30 on every weekday") via `cronstrue`. Validates and flags malformed fields inline.
  - **Schedule → cron** — a builder (minute/hour/day-of-month/month/day-of-week pickers, plus common presets: hourly, daily at time, weekly, monthly, weekdays) that emits the matching pattern.
  - **Next run preview** — compute and list the next N fire times via `cron-parser`, **timezone-aware** (default to the user's zone; expose a picker — Asia/Jakarta et al.) so schedules are interpreted correctly.
  - **Flavor toggle** — support standard 5-field (Unix/`node-cron`) and 6-field with seconds (Quartz/some schedulers), plus special strings (`@daily`, `@hourly`, `@reboot`). Note which flavor the output targets, since they aren't interchangeable.
- **HTML viewer / live playground** — three linked editors (**HTML + CSS + JS**) with an instant live preview, CodePen/JSFiddle-style but fully local. Renders into a **sandboxed `<iframe srcdoc>`** using `sandbox="allow-scripts"` *without* `allow-same-origin`, so user JS runs isolated from the shell and can't read app state, storage, or cookies. Features: debounced auto-run + manual "Run", split or tabbed layout with resizable panes, a **captured console panel** (relay `console.*` and uncaught errors from the iframe via `postMessage`), format-on-demand via `prettier`, and **export as a single self-contained `.html`** file. **[DECISION]** external-resource handling: a toggle + allowlist for `<script src>`/`<link href>` CDN references, **off by default** to preserve the no-egress promise — this is the one dev tool where *user-authored* code could make network calls, so it's opt-in and clearly labeled. Editors via CodeMirror/Monaco.
- **Structured data diff** — side-by-side compare of **JSON, YAML, TOML, and XML**. Parse each side to a normalized tree first (via `yaml`, `@iarna/toml`, `fast-xml-parser`, native `JSON`), then diff *semantically* — so key reordering, indentation, and quoting differences don't register as changes. Also supports **cross-format** compare (e.g. a YAML config vs its JSON equivalent) by normalizing both to the same tree before diffing. Output modes: (a) two-pane color-coded view with added/removed/changed lines, and (b) a collapsible tree diff highlighting the changed paths. Optional "raw text diff" toggle for when literal formatting *does* matter. Deep-diff via `microdiff`/`deep-object-diff`; rendered with a monaco/CodeMirror diff view.

### Media (`ffmpeg.wasm` — powerful, heavy ~25MB core, needs isolation)
Video compress/convert/trim/cut, video→GIF, video→audio, audio convert/trim. Screen recorder via native `MediaRecorder` (no wasm). Gate the whole family behind cross-origin isolation + an explicit "this downloads ~25MB" notice.

- **Screenshot (delayed capture + crop)** — click → **native screen/window/tab picker** (`getDisplayMedia`, unavoidable by design) → **5–10s countdown** to arrange/focus the target → grab a frame from the still-live stream onto a canvas → user **drags a crop rectangle** on the captured image → export PNG/JPG, fully client-side. Constraints: DRM/protected content captures as black; the native picker can't be pre-selected or suppressed; Safari uses canvas-draw (no `ImageCapture.grabFrame`); cursor inclusion set via constraint (`always`/`motion`/`never`). **Extension-enhanced mode (optional):** a true **global hotkey** that fires while another window is focused, plus a **region-select overlay over the whole desktop** — capabilities the page sandbox cannot provide (see §6). Falls back to the countdown flow when the extension isn't installed.

---

## 6. Optional Companion Extension (progressive enhancement)

A few capabilities are simply impossible inside the page sandbox: a **global hotkey that fires while another app is focused**, **drawing a selection rectangle over the whole desktop**, and richer clipboard/native integration. An **optional browser extension** unlocks these for the specific tools that need them — while the site stays fully usable without it. The extension is a thin *capability shim*, not a second app: all tool UI and logic stay in the web app so there's one codebase of record.

**Non-negotiable — the extension holds the same line as the site:**
- **Offline & no egress.** Manifest V3 forbids remotely-hosted code, which works in our favor: all logic ships in the bundle, nothing is fetched at runtime, and it runs with the network off. No host permissions that phone home, no analytics. Captured pixels/data are handed to the local page or saved directly — never uploaded.
- **Least privilege.** Request the narrowest permission per feature and explain each in-product: `commands` (global hotkeys), `desktopCapture`/`activeTab`/`tabs` (capture), `scripting`, `clipboardRead`/`clipboardWrite` as needed. Avoid broad `<all_urls>` host access; prefer `activeTab` + on-demand injection.
- **Progressive enhancement, never a wall.** Every extension-gated tool degrades to a pure-web flow (e.g. screenshot → countdown capture). The site detects the extension via `externally_connectable` + a ping; if absent it shows an "Install to unlock global hotkey / desktop region-select" affordance and falls back gracefully. Nothing that *can* work in-page is locked behind the extension.
- **Page ↔ extension bridge.** The site messages the extension via `chrome.runtime.sendMessage` (origin allowlisted through `externally_connectable`); the extension performs the privileged action and returns the result (e.g. a cropped PNG blob) back to the page for the normal client-side pipeline.

**Distribution [DECISION]:** Chrome Web Store / Edge Add-ons / Firefox AMO for reach, plus an optional signed self-host / "load unpacked" build for users who want to audit and sideload. Store review adds latency and its own privacy disclosures — factor into timeline.

**Tools that benefit:** Screenshot (global hotkey + desktop region-select), Screen recorder (region capture, finer control), a global color picker where the in-page `EyeDropper` API is unavailable, and any "capture anything" flows.

---

## 7. Cross-Cutting Concerns

**Privacy proof & trust**
- Strict CSP (set in Cloudflare `_headers`): `connect-src 'self'` plus only the same-origin/R2 model host — nothing else. Document it on the `/privacy` page with a "verify it yourself" walkthrough (DevTools → Network shows zero third-party calls during processing).
- **Open source = auditable.** Public GitHub repo; footer links the exact deployed commit. Because the build is static and client-side, anyone can clone, build, and diff against production, or run it offline. Add reproducible-build notes to the README.
- SRI hashes on all remote WASM/model fetches.
- Offline PWA: once installed, tools work with the network fully off — the clearest possible demonstration that data isn't leaving.
- Optional "Airplane mode indicator" showing zero pending network requests during processing.

**Performance budget**
- Initial shell: < 150KB gzipped JS. Each tool chunk lazy. Show asset-size before triggering a big download ("Background eraser needs a 45MB model — download & cache?").
- WebGPU path with WASM fallback for ONNX tools; feature-detect.
- **Shared editor engine.** Monaco is used by several tools (multi-cursor editor, structured diff, HTML playground, formatters). Load it **once, lazily**, and share the instance across them — don't bundle it per-tool. It's a few hundred KB+, so it must never touch the initial shell payload; register only the languages actually needed.

**Accessibility & UX**
- Keyboard-first (⌘K palette, shortcuts), ARIA on all controls, focus management, prefers-reduced-motion, light/dark.
- Consistent Dropzone, FileList, ProgressBar, ResultActions (download/copy/save-as) components reused everywhere.

**Error handling**
- Worker crash isolation (one tool failing never takes down the shell). OOM guidance for huge files ("try the streaming/large-file mode"). Clear messaging when isolation/WebGPU unavailable.

**Testing**
- Unit tests for pure transforms (formatters, converters, crypto format round-trips).
- Playwright E2E per tool: load sample file → run → assert output, plus a network assertion that **no request goes to a non-allowlisted origin**.
- Golden-file tests for PDF/image outputs where feasible.

**Licensing note**
- Verify licenses/model weights before bundling (e.g. RMBG variants, Real-ESRGAN, ffmpeg builds). Track in `LICENSES.md`. **[DECISION]** confirm each ML model's commercial-use terms.

---

## 8. Phased Roadmap

**Phase 0 — Foundation** *(no user-facing tools yet)*
Astro project (`output: 'static'`) with `@astrojs/react` + Tailwind + `@vite-pwa/astro`; View Transitions + persisted shell island (nav + ⌘K palette); tool registry; shared services (FileService, WorkerPool, AssetCache, DownloadService, Progress); Cloudflare Pages deploy from GitHub with `_headers` serving COOP/COEP + CSP; PWA scaffold; one throwaway "hello worker + wasm" island to prove the full pipeline (island → Comlink → worker → WASM → cross-origin-isolated).

**Phase 1 — Dev/Office utilities (pure JS)**
Highest value-to-effort, zero WASM risk, validates the shell UX: JSON tools, diff, Base64/URL/JWT, hash, password/UUID gen, QR gen+read, Markdown, CSV↔JSON, converters. Ship to build momentum.

**Phase 2 — PDF suite**
Merge, split, reorder, rotate, delete, images→PDF, PDF→image, watermark, password protect/remove, compress. (Redaction + OCR deferred to a PDF-advanced sub-phase.)

**Phase 3 — Image basics**
Compressor, format convert, resize/crop/batch, watermark, **EXIF scrubber**. All Canvas/squoosh — no ML yet.

**Phase 4 — Files & crypto**
Zip-with-password, 7z/rar/tar extract, AES file encrypt/decrypt (finalize file format), hashing large files, split/join.

**Phase 5 — ML image tools**
Background eraser, object remover, upscaler, and **blur & auto-redact** (face/plate/text detection). onnxruntime-web + WebGPU. Model cache UX, size warnings, license checks. Ship the face-blur path first (most reliable + highest demand); plate/text detection follow.

**Phase 6 — Drawing**
Excalidraw embed (or custom), signature pad (wire into PDF signing), diagram/mind-map.

**Phase 7 — Media**
ffmpeg.wasm family behind isolation + size gate. Screenshot (delayed capture + crop), screen recorder. Ship last of the core tools (heaviest, most edge cases).

**Phase 8 — Companion extension (optional, parallelizable)**
Thin MV3 capability-shim: global-hotkey screenshot + desktop region-select overlay, returning results to the web app via the `externally_connectable` bridge. Web fallbacks must already exist before this ships. Can be built in parallel once the screenshot web flow (Phase 7) is stable. Store submissions + self-host build.

**Suggested MVP launch** = Phases 0–3 (utilities + PDF + image basics). That already covers the most common "I don't want to upload this to a random site" office moments.

---

## 9. Open Decisions (confirm before/at each phase)
- [x] ~~Framework~~ → **Astro + React islands, static output** (resolved). Vue only if dropping Excalidraw/tldraw.
- [ ] Shell persistence: Astro View Transitions + `transition:persist` (recommended) vs single full-page SPA island.
- [ ] PDF encryption library (pdf-lib vs mupdf-wasm) for password strength.
- [ ] Crypto KDF: Argon2 (recommended) vs PBKDF2; finalize encrypted-file header format.
- [ ] Excalidraw embed vs custom canvas for whiteboard (keep React → Excalidraw stays easy).
- [ ] ML model weights + licenses: background removal, upscaler, **and detection models** (face: BlazeFace/SCRFD/RetinaFace; plate: YOLO-plate; text: DBNet/PaddleOCR-det) — verify commercial-use terms per model.
- [x] ~~Hosting~~ → **Cloudflare Pages (static)**, `_headers` for COOP/COEP + CSP (resolved).
- [ ] Serve large models/WASM same-origin (`public/`) vs Cloudflare **R2** — both keep COEP simple; R2 better for big files/bandwidth.
- [ ] Ship the optional companion extension? Which stores + whether to offer a self-host/unpacked build.
- [ ] Extension permission set per feature (`commands`/`desktopCapture`/`clipboard`) and the `externally_connectable` origin allowlist.
- [ ] Ship the optional companion extension? Which stores + whether to offer a self-host/unpacked build.
- [ ] Extension permission set per feature (`commands`/`desktopCapture`/`clipboard`) and the `externally_connectable` origin allowlist.
