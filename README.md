# GoodWebTools

Privacy-first client-side utilities. All processing happens in your browser.

## Features

- **100% Client-Side** - No file uploads, no servers
- **Works Offline** - Install as PWA (coming soon)
- **Open Source** - Audit the code yourself
- **Privacy-First** - Verify with DevTools Network tab

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
npm install
npm run dev
```

Open http://localhost:4321

### Scripts

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Architecture

- **Astro** - Static site with View Transitions
- **React** - Islands for interactivity
- **Tailwind CSS** - Styling
- **Nanostores** - State management
- **Comlink** - Worker communication
- **Vitest** - Testing

## Status

✅ **Phase 0 — Foundation complete:**
- Tool registry with search + command palette (⌘K)
- Theme system (light/dark)
- Shared services (File, Worker, Asset, Download, Progress, Persistence)
- Registry-driven dynamic tool routing (`ToolHost`)

✅ **Phase 1 — Dev utilities (17 tools):**
- JSON Formatter/Validator
- Base64 Encode/Decode
- URL Encode/Decode
- JWT Decoder (decode-only)
- UUID v4 Generator
- Password Generator (Bitwarden-style: unbiased RNG, guaranteed types, min numbers/special)
- Text Diff (line-level)
- CSV ↔ JSON converter (configurable delimiter: comma, semicolon, tab, pipe)
- JSON ↔ YAML converter
- JSON ↔ XML converter
- JSON ↔ TOML converter
- Number Base Converter (bin/oct/dec/hex)
- Color Converter (HEX/RGB/HSL)
- Markdown Preview (sanitized)
- QR Code Generator
- QR Code Reader
- Timestamp Converter
- Hash File (MD5 / SHA-1 / SHA-256 / SHA-512, streamed in a worker for large files)

✅ **Phase 2 — PDF suite (11 tools):**
- Merge PDFs (reorderable)
- Split PDF (extract page range)
- Rotate PDF (90/180/270°)
- Delete PDF pages
- Watermark PDF (diagonal text)
- Images → PDF (PNG/JPG)
- PDF → Images (paginated, PNG/JPG, ZIP-all)
- Compress PDF
- Protect PDF (AES-256 password)
- Unlock PDF (remove password)

Engine: **mupdf-wasm** (in a worker) parses/edits real-world PDFs that pdf-lib
can't; `pdfjs-dist` renders pages; `pdf-lib` builds images→PDF and draws
watermarks. All fully client-side. (mupdf is AGPL — fine while this stays open source.)

## Design

**Neo-Brutalism** — thick outlines, hard offset shadows, sharp corners, bold
Space Grotesk (self-hosted, same-origin to preserve zero external requests).
Fluid-width, mobile-first layout.

✅ **Phase 3 — Image basics (8 tools):**
- Image Converter (PNG / JPEG / WebP / AVIF / GIF / ICO favicon / SVG)
- Image Compressor (quality, size delta)
- Image Resizer (aspect-lock)
- Image Cropper (persistent, resizable crop box)
- Merge Images (stack vertical / horizontal / grid with a column picker, reorderable, gap + background)
- Image Watermark (diagonal / tiled / corner)
- Image Annotator (arrows, shapes, text, highlighter, blur — Lark-style; Select to move / rename / delete)
- Metadata Scrubber (strip EXIF/GPS by re-encoding)

All Canvas-based, fully client-side (`src/tools/image/canvas.lib.ts`).
Every image tool accepts a **paste from clipboard** (⌘/Ctrl+V) in, and every
result offers **Download** and **Copy to clipboard**.

✅ **Phase 4 — Files & crypto (5 tools):**
- File Encrypt / Decrypt — password-lock any file with **AES-256-GCM** and a
  PBKDF2 key (250k iterations, SHA-256). Self-describing `.gwtenc` container.
  WebCrypto only, no dependencies.
- Zip / Unzip — bundle any files into a `.zip`, or extract one and download
  individual entries. `fflate`, fully client-side.
- Archive Extractor — extract **RAR, 7z, TAR, GZ, ZIP** and more via
  `libarchive.js` (WASM, self-hosted worker). Extract-only — creating .rar/.7z
  isn't possible client-side (proprietary formats).
- File Split / Join — cut a large file into fixed-size parts (`.001`, `.002`…)
  and rejoin them. Lazy `Blob.slice`, no full-file buffering.
- (Hash File gained MD5 / SHA-1 / SHA-256 / SHA-512 with chunked streaming.)

✅ **Phase 5 — ML image tools (5 tools, on-device AI):**
- Background Remover — removes an image background with an **on-device AI model**
  (ISNet via `@imgly/background-removal` + onnxruntime-web WASM). The image never
  leaves the browser; the model (~40 MB) is served same-origin from **R2** and
  cached. Outputs a transparent PNG.
- Face Blur — auto-detects faces (MediaPipe BlazeFace, ~230 KB) and hides them
  with blur / pixelate / solid — all on-device. Great for anonymizing photos.
- Image Upscaler — enlarges images 2–4× with an **ESRGAN** super-resolution
  model (UpscalerJS + TensorFlow.js, ~1 MB, tiled). On-device; caps input at
  ~1.2 MP so the browser stays responsive.
- Portrait Blur — "portrait mode" bokeh: reuses the background-removal model to
  keep the subject sharp and blur the background (adjustable strength).
- Object Remover **(experimental)** — paint over an object and erase it with
  **LaMa** inpainting (onnxruntime-web). Big model (~200 MB) + a consent gate
  warning about the download and hardware needs; on-device only.

Model assets are hosted in a Cloudflare **R2** bucket (see `DEPLOYMENT.md`) to
stay same-origin without hitting the 25 MB static-asset limit.

✅ **Phase 6 — Drawing (2 tools):**
- Whiteboard — infinite-canvas sketching, diagrams, flowcharts, and mind maps
  (embeds **Excalidraw**; fonts self-hosted so there are still zero external
  requests). Export PNG / SVG / `.excalidraw`.
- Signature Pad — draw a signature and export as PNG or SVG (`signature_pad`).

✅ **Phase 7 — Media (6 tools):**
- Video → GIF — turn a video clip into an animated GIF (fps/width/trim, two-pass
  palette for quality).
- Video Converter — convert / compress / trim / resize video between MP4 (H.264),
  WebM (VP9) and MOV, with a CRF quality slider and optional audio drop.
- Video → Audio — rip the audio track out of a video to MP3 / M4A / WAV / Opus.
- Audio Converter — convert, re-encode (bitrate) or trim audio: MP3 / M4A / Opus /
  WAV / FLAC.
- Screen Recorder — record a tab, window or the whole screen (optionally + mic)
  with the native `MediaRecorder` — no WASM, nothing uploaded.
- Screenshot — capture the screen with a countdown, then drag a crop rectangle and
  export PNG / JPG (native `getDisplayMedia` + canvas).

The four ffmpeg tools share one **ffmpeg.wasm** engine (single-thread core, so no
cross-origin-isolation headers are needed), self-hosted from R2. The video/audio
never leaves your device.

## Testing

Unit tests cover the pure tool logic (parsers, generators, hash, image math,
file crypto, format converters): `npm run test` — **237 tests across 25 files**.

## Deployment

Deployed to **Cloudflare Workers** (static assets) with model files streamed
from an **R2** bucket. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide.

**Quick deploy:**
```bash
npm run deploy          # = npm run build && wrangler deploy
```

## License

MIT
