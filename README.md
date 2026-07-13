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

🚧 **Phase 4 — Files & crypto (in progress):**
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

🚧 **Phase 5 — ML image tools (in progress):**
- Background Remover — removes an image background with an **on-device AI model**
  (ISNet via `@imgly/background-removal` + onnxruntime-web WASM). The image never
  leaves the browser; the model (~40 MB) is served same-origin from **R2** and
  cached. Outputs a transparent PNG.
- Face Blur — auto-detects faces (MediaPipe BlazeFace, ~230 KB) and hides them
  with blur / pixelate / solid — all on-device. Great for anonymizing photos.
- Image Upscaler — enlarges images 2–4× with an **ESRGAN** super-resolution
  model (UpscalerJS + TensorFlow.js, ~1 MB, tiled). On-device; caps input at
  ~1.2 MP so the browser stays responsive.

Model assets are hosted in a Cloudflare **R2** bucket (see `DEPLOYMENT.md`) to
stay same-origin without hitting the 25 MB static-asset limit.

## Testing

Unit tests cover the pure tool logic (parsers, generators, hash, image math,
file crypto, format converters): `npm run test` — **227 tests across 24 files**.

**Next (Phase 4 cont.):** zip create/extract, large-file hashing, split/join.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick deploy to Cloudflare Pages:**
```bash
npm run build
npx wrangler pages deploy dist --project-name=goodwebtools
```

## License

MIT
