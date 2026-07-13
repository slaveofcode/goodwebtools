# Deployment Guide

GoodWebTools is a **static Astro site** deployed to **Cloudflare Workers** (with
Static Assets), plus a small Worker that streams the AI-tool model files from an
**R2 bucket**. Everything runs client-side; the Worker only serves files.

> **Prefer push-to-deploy?** For a two-branch, git-based auto-deploy
> (`main` → production, `develop` → staging) with **no GitHub Actions**, see
> [DEPLOYMENT-GIT.md](./DEPLOYMENT-GIT.md). This guide covers the architecture,
> the one-time R2 model upload (shared by both), and manual/CLI deploys.

## Architecture

- `npm run build` → static site in `dist/` (HTML, JS, CSS, WASM).
- `worker/index.js` → serves `/models/*` from the R2 bucket `MODELS`, and
  delegates everything else to the static build (`ASSETS` binding).
- `wrangler.jsonc` → wires it together (`main`, `assets`, `r2_buckets`).

> **Workers, not Pages.** This project deploys **one Cloudflare Worker with
> Static Assets** — *not* Cloudflare Pages. A Worker is required because a plain
> static/Pages site can't stream the large ML model files at `/models/*`; the
> Worker sits in front and routes `/models/*` to **R2** while serving everything
> else from the bundled **Static Assets**. (The static-asset half plays the role
> Pages would, but it's all a single Worker.)

### Deployment flow (build → deploy → runtime)

```
 BUILD & DEPLOY — automatic on every push (Cloudflare Workers Builds; no GitHub Actions)

 ┌─────────────┐  git push   ┌────────────────────────┐  npm run build   ┌────────────────┐
 │ GitHub repo │ ──────────▶ │ Cloudflare Workers      │ ───────────────▶ │ dist/          │
 │ main /      │  (branch    │ Builds  (CI runner)     │  + postbuild      │ static site:   │
 │ develop     │   watched)  │                         │  prune            │ HTML·JS·CSS·   │
 └─────────────┘             │  then: wrangler deploy  │                   │ fonts·small    │
                             └───────────┬─────────────┘                   │ wasm (mupdf,   │
                                         │ deploys                         │ libarchive,    │
                                         │ the Worker                      │ sqlite)        │
                                         ▼                                 └───────┬────────┘
        ┌──────────────────────────────────────────────────────────┐              │ uploaded as
        │              Cloudflare Worker  (worker/index.js)          │◀─────────────┘ Static Assets
        │   binding ASSETS ─▶ dist/   ·   binding MODELS ─▶ R2       │
        └──────────────────────────────────────────────────────────┘
                                         ▲
                                         │ read at runtime (NOT part of the git build)
        ┌──────────────────────────────────────────────────────────┐
        │   R2 bucket "goodwebtools-models"  — uploaded ONCE, by hand │
        │   /imgly /mediapipe /esrgan-slim /ort /lama /ffmpeg  (~540 MB of ML models + wasm)
        └──────────────────────────────────────────────────────────┘


 RUNTIME — every visitor request

   Browser ──▶ Cloudflare Worker (worker/index.js)
                    │
                    ├─ path starts with /models/  ─▶ env.MODELS.get(key) ─▶ R2 bucket   (big models)
                    │                                   hit → stream + immutable cache; miss → 404
                    │
                    └─ anything else               ─▶ env.ASSETS.fetch()  ─▶ dist/ static assets
                                                        (HTML, JS, CSS, fonts, small wasm)
```

**What goes where**

| Content | Lives in | Served by | Deployed by |
|---------|----------|-----------|-------------|
| HTML · JS · CSS · fonts · small wasm (mupdf, libarchive, sqlite) | Worker **Static Assets** (from `dist/`) | `ASSETS` binding | `git push` → Workers Builds |
| The routing logic (`/models/*` → R2, else → assets) | The **Worker** (`worker/index.js`) | the Worker itself | `git push` → Workers Builds |
| Large ML models + ORT/ffmpeg wasm (~540 MB) | **R2** bucket `goodwebtools-models` | `MODELS` binding (Worker streams) | **one-time manual** upload (`wrangler r2 object put`) |

The models are the only piece that is **not** part of the git build — they're
uploaded to R2 once (see below) and are immutable, so a normal push never
re-uploads ~540 MB. For the two-branch git wiring (main → production,
develop → staging), see [DEPLOYMENT-GIT.md](./DEPLOYMENT-GIT.md).

## One-time setup

You need a Cloudflare account and the Wrangler CLI (pinned as a devDependency).

```bash
npx wrangler login                                  # authenticate
npx wrangler r2 bucket create goodwebtools-models   # create the model bucket
```

### Upload the ML model assets to R2

The Phase-5 AI tools each need model + runtime files (**~540 MB total**) that are
**not** committed — they live in R2 under `/models/`, mirroring the on-disk
layout. `npm run stage:models` fetches/copies them all into `public/models/`:

| Prefix | Tool(s) | Approx size |
|--------|---------|-------------|
| `imgly/` | Background Remover, Portrait Blur (ISNet + ort) | ~211 MB |
| `mediapipe/` | Face Blur (BlazeFace + tasks-vision WASM) | ~35 MB |
| `esrgan-slim/` | Image Upscaler (ESRGAN weights) | ~4 MB |
| `ort/` | Object Remover (onnxruntime-web WASM) | ~76 MB |
| `lama/` | Object Remover (LaMa ONNX, fixed 512×512) | ~200 MB |
| `ffmpeg/` | Video → GIF and other Media tools (ffmpeg.wasm **ESM** core) | ~31 MB |

Stage, then upload the whole tree (keys must keep their subfolders):

```bash
npm run stage:models   # → public/models/** (gitignored; downloads LaMa + face model)

# upload every staged file to R2, preserving the relative path as the key
cd public/models
find . -type f | while read -r f; do
  key="${f#./}"
  npx wrangler r2 object put "goodwebtools-models/$key" --file "$f"
done
cd ../..
```

(You can also drag the folders into the bucket via the Cloudflare dashboard, or
use `rclone` for the bulk upload.) After bumping a model version, re-stage and
re-upload that prefix. **Until the models are in R2, the AI tools 404 in prod.**

> **Local dev:** `npm run stage:models` also lets `npm run dev` serve the models
> from `public/models/**`. Remove that folder before a *local* `wrangler deploy`
> so ~540 MB isn't uploaded as static assets — production loads them from R2.
> (CI never has it: `public/models/` is gitignored.)

## Deploying

### Option A — Cloudflare Workers Builds (recommended, git-based)

Connect the GitHub repo in the Cloudflare dashboard → Workers & Pages → Create →
Import a repository, then set:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Production branch:** the branch you want live (currently the app lives on
  `develop` — set this to `develop`, or merge `develop → main` first).

Cloudflare rebuilds and deploys on every push to that branch.

### Option B — Manual

```bash
npm run deploy          # = npm run build && wrangler deploy
```

## Notes & troubleshooting

- **`wrangler deploy` needs the R2 bucket to exist** — create it first (above),
  or the deploy fails on the `MODELS` binding.
- **Per-file asset limit is 25 MB.** The site's own WASM (mupdf ~10 MB,
  libarchive ~1 MB) is fine; large ML models go to R2 precisely to avoid this.
  onnxruntime-web's wasm gets emitted into `dist/_astro` at ~26 MB but is unused
  (ORT loads from `/models/ort/`); the `postbuild` step (`scripts/prune-dist.mjs`)
  removes it automatically so deploys stay under the limit.
- **Model versions must match.** `@imgly/background-removal` and
  `@imgly/background-removal-data` are pinned to the same version; a mismatch
  causes "Resource … not found" at runtime.
- **404s / routing:** Astro emits `dist/tools/<id>/index.html`; Cloudflare
  serves trailing-slash variants automatically and uses `dist/404.html`
  (`not_found_handling: "404-page"`).
- **Secrets:** none are committed. Wrangler auth is via `wrangler login` or the
  `CLOUDFLARE_API_TOKEN` env var; `.dev.vars`, `.env*`, and `.wrangler/` are
  gitignored.

## Cost

Cloudflare's free tier covers this comfortably: static assets have unlimited
bandwidth, and R2 has a generous free tier for storage + egress (models are
immutable and hard-cached, so they download once per visitor).
