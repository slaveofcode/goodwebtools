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

✅ **Phase 1 — Dev utilities (14 tools):**
- JSON Formatter/Validator
- Base64 Encode/Decode
- URL Encode/Decode
- JWT Decoder (decode-only)
- UUID v4 Generator
- Password Generator (Bitwarden-style: unbiased RNG, guaranteed types, min numbers/special)
- Text Diff (line-level)
- CSV ↔ JSON converter
- Number Base Converter (bin/oct/dec/hex)
- Color Converter (HEX/RGB/HSL)
- Markdown Preview (sanitized)
- QR Code Generator
- QR Code Reader
- Timestamp Converter
- Hash File (SHA-256, worker-based)

🚧 **Phase 2 — PDF suite (7 tools, in progress):**
- Merge PDFs (reorderable)
- Split PDF (extract page range)
- Rotate PDF (90/180/270°)
- Delete PDF pages
- Watermark PDF (diagonal text)
- Images → PDF (PNG/JPG)
- PDF → Images (render pages to PNG via pdf.js)

`pdf-lib` for editing, `pdfjs-dist` for rendering — all fully client-side.

## Design

**Neo-Brutalism** — thick outlines, hard offset shadows, sharp corners, bold
Space Grotesk (self-hosted, same-origin to preserve zero external requests).
Fluid-width, mobile-first layout.

**Next:** compress, password (Phase 2 cont.); then Phase 3 — Image basics

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick deploy to Cloudflare Pages:**
```bash
npm run build
npx wrangler pages deploy dist --project-name=goodwebtools
```

## License

MIT
