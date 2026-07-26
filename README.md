# GoodWebTools

Privacy-first daily-driver web tools that run **entirely in your browser** — your
files never leave your device.

**Live:** https://goodwebtools.com · **Desktop app:** see [Releases](https://github.com/slaveofcode/goodwebtools/releases)

![CI](https://github.com/slaveofcode/goodwebtools/actions/workflows/ci.yml/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Why

Most "online tools" upload your files to a server. GoodWebTools does the work
client-side with WebAssembly, canvas, and on-device ML — so nothing is uploaded,
tracked, or stored remotely.

## Tools

Dozens of tools across **Dev**, **PDF**, **Image**, **Files**, **Draw**, **Media**,
and **Playground** categories — JSON/Base64/JWT utilities, image convert/compress/
resize/annotate, background & object removal, PDF↔image, an Excalidraw whiteboard,
a DB-diagram (DBML) designer, QR tools, and more. Browse them all at
[goodwebtools.com](https://goodwebtools.com).

## Tech

- [Astro](https://astro.build) static site + **React islands** (per-tool, lazy-loaded)
- Client-side processing: WebAssembly, Canvas, `onnxruntime-web`, `@imgly/background-removal`, `mupdf`, `ffmpeg.wasm`
- Desktop app via [Tauri 2](https://tauri.app)
- Deployed on **Cloudflare Workers** (static assets + R2 for ML models)

## Run locally

```bash
npm install --legacy-peer-deps
npm run dev            # http://localhost:4321
```

## Contributing

New tools and fixes welcome — the tool registry makes adding one straightforward.
See **[CONTRIBUTING.md](./CONTRIBUTING.md)** (includes an "add a tool" walkthrough)
and the **[Code of Conduct](./CODE_OF_CONDUCT.md)**.

## Self-hosting

You can run your own instance on Cloudflare — see the "Deploy your own instance"
section in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## License

[MIT](./LICENSE)
