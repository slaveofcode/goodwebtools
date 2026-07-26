# Deployment Guide

GoodWebTools is a **static Astro site** deployed to **Cloudflare Workers** (with
Static Assets), fronted by a small Worker that streams the AI-tool model files
from an **R2 bucket**. Everything runs client-side; the Worker only serves files.

Deploys are **push-to-deploy** via Cloudflare Workers Builds — Cloudflare watches
the GitHub branches and builds + deploys on every push. **No GitHub Actions.**

- Push to **`main`** → **production** (`goodwebtools.com`)
- Push to **`develop`** → **staging** (`goodwebtools-staging.workers.dev`)

## Architecture

- `npm run build` → static site in `dist/` (HTML, JS, CSS, WASM).
- `worker/index.js` → serves `/models/*` from the R2 bucket (`MODELS` binding),
  and delegates everything else to the static build (`ASSETS` binding).
- `wrangler.jsonc` → wires it together (worker name, `assets`, `r2_buckets`, and
  the `env.staging` environment).

> **Workers, not Pages.** This deploys **one Cloudflare Worker with Static
> Assets** — *not* Cloudflare Pages. A Worker is required because a plain static
> site can't stream the large ML model files at `/models/*`; the Worker routes
> `/models/*` to **R2** and serves everything else from the bundled Static Assets.

```
 BUILD & DEPLOY — automatic on every push (Cloudflare Workers Builds)

 ┌─────────────┐  git push   ┌────────────────────────┐  npm run build   ┌────────────────┐
 │ GitHub repo │ ──────────▶ │ Cloudflare Workers      │ ───────────────▶ │ dist/          │
 │ main /      │  (branch    │ Builds  (CI runner)     │  + postbuild      │ static site    │
 │ develop     │   watched)  │  then: wrangler deploy  │  prune            │                │
 └─────────────┘             └───────────┬─────────────┘                   └───────┬────────┘
                                         │ deploys the Worker                      │ uploaded as
                                         ▼                                         │ Static Assets
        ┌──────────────────────────────────────────────────────────┐◀─────────────┘
        │              Cloudflare Worker  (worker/index.js)          │
        │   binding ASSETS ─▶ dist/   ·   binding MODELS ─▶ R2       │
        └──────────────────────────────────────────────────────────┘
                                         ▲ read at runtime (NOT part of the git build)
        ┌──────────────────────────────────────────────────────────┐
        │   R2 bucket "goodwebtools-models"  — uploaded ONCE, by hand │
        │   /imgly /mediapipe /esrgan-slim /ort /lama /ffmpeg  (~540 MB)
        └──────────────────────────────────────────────────────────┘

 RUNTIME — every visitor request
   Browser ──▶ Worker ──┬─ /models/*  ─▶ env.MODELS.get(key) ─▶ R2   (hit → stream + immutable cache; miss → 404)
                        └─ everything  ─▶ env.ASSETS.fetch()  ─▶ dist/ static assets
```

**What goes where**

| Content | Lives in | Served by | Deployed by |
|---------|----------|-----------|-------------|
| HTML · JS · CSS · fonts · small wasm (mupdf, libarchive, sqlite) | Worker Static Assets (from `dist/`) | `ASSETS` binding | `git push` → Workers Builds |
| Routing logic (`/models/*` → R2, else → assets) | The Worker (`worker/index.js`) | the Worker itself | `git push` → Workers Builds |
| Large ML models + ORT/ffmpeg wasm (~540 MB) | **R2** bucket | `MODELS` binding | **one-time manual** upload (`npm run sync:r2`) |

The models are the only piece **not** part of the git build — uploaded to R2 once
(see below) and immutable, so a normal push never re-uploads ~540 MB.

## Environments

Two Cloudflare **Worker** services, both connected to the **same** GitHub repo,
each watching a different production branch:

| Environment | Worker service | Branch | Deploy command | URL |
|-------------|----------------|--------|----------------|-----|
| Production | `goodwebtools` | `main` | `npx wrangler deploy` | `goodwebtools.com` |
| Staging | `goodwebtools-staging` | `develop` | `npx wrangler deploy --env staging` | `goodwebtools-staging.workers.dev` |

The `staging` environment is defined in [`wrangler.jsonc`](./wrangler.jsonc)
(`env.staging`). Each environment has its **own** R2 bucket
(`goodwebtools-models` / `goodwebtools-models-staging`).

```
git push origin main     ─▶ Workers Builds ─▶ wrangler deploy               ─▶ production
git push origin develop  ─▶ Workers Builds ─▶ wrangler deploy --env staging  ─▶ staging
```

## One-time setup

You need a Cloudflare account and the Wrangler CLI (pinned as a devDependency).

### 1. Authenticate + create the R2 buckets

```bash
npx wrangler login
npx wrangler r2 bucket create goodwebtools-models           # production models
npx wrangler r2 bucket create goodwebtools-models-staging   # staging models
```

### 2. Upload the ML model assets to R2

The AI tools need model + runtime files (**~540 MB total**) that are **not**
committed — they live in R2 under `/models/`, mirroring the on-disk layout.

| Prefix | Tool(s) | Approx size |
|--------|---------|-------------|
| `imgly/` | Background Remover, Portrait Blur | ~211 MB |
| `mediapipe/` | Face Blur | ~35 MB |
| `esrgan-slim/` | Image Upscaler | ~4 MB |
| `ort/` | Object Remover (onnxruntime-web WASM) | ~76 MB |
| `lama/` | Object Remover (LaMa ONNX) | ~200 MB |
| `ffmpeg/` | Video/audio tools (ffmpeg.wasm) | ~31 MB |

Stage them locally, then sync to R2 (`sync:r2` reads the bucket names from
`wrangler.jsonc`, so it targets whatever prod/staging are configured to use):

```bash
npm run stage:models       # → public/models/** (gitignored; downloads LaMa + face model)

# Cloudflare auth first: set CLOUDFLARE_API_TOKEN, or `npx wrangler login`
npm run sync:r2            # upload to every configured bucket (prod + staging)
npm run sync:r2:prod      # …or just production
npm run sync:r2:staging   # …or just staging
npm run sync:r2 -- --dry-run   # preview without uploading
```

Uploads are idempotent (`wrangler r2 object put --remote`), so re-running retries
failures and re-staging + re-syncing updates a bumped model version. (You can
also drag the folders into the bucket via the dashboard, or use `rclone`.)
**Until the models are in R2, the AI tools 404.**

> **Local dev:** `npm run stage:models` also lets `npm run dev` serve the models
> from `public/models/**`. `public/models/` is gitignored, so CI never uploads it.

### 3. Connect Workers Builds (one Worker per environment)

In the Cloudflare dashboard → **Workers & Pages → Create → Workers → Import a
repository**, create **two** Workers from the same repo:

| | Production | Staging |
|--|-----------|---------|
| **Worker name** | `goodwebtools` | `goodwebtools-staging` |
| **Production branch** | `main` | `develop` |
| **Build command** | `npm run build` | `npm run build` |
| **Deploy command** | `npx wrangler deploy` | `npx wrangler deploy --env staging` |

Then attach the custom domain (`goodwebtools.com`) to the production Worker under
**Settings → Domains & Routes**. From now on, every push to `main`/`develop`
auto-builds and deploys the matching environment.

### 4. Build variables

Analytics and indexing are **auto-gated by branch** in `astro.config.mjs` (using
the `WORKERS_CI_BRANCH` Cloudflare injects), so you barely configure anything:

| | Production (`main`) | Staging / other branches |
|--|--------------------|--------------------------|
| Google Analytics | on — from `SITE_GA_ID` | off |
| `robots` | `index, follow` | `noindex, nofollow` |

The **only** build variable to set is `SITE_GA_ID` on the **production** Worker
(Workers Builds → Settings → Build → Variables) — your GA4 id, e.g.
`G-XXXXXXXXXX`. Leave it unset to disable analytics. Everything else is automatic;
you do **not** set `PUBLIC_NOINDEX` by hand (the branch gate handles it). GA is
also consent-gated — it only loads after the visitor accepts the cookie banner.

> These are **build-time** variables (Vite inlines `import.meta.env.PUBLIC_*` into
> the static output), so they must be **Build variables**, not Worker runtime
> bindings. Changes take effect on the next push/redeploy.

## Everyday deploys

Just push — Workers Builds does the rest:

```bash
git push origin develop   # → staging
git push origin main      # → production
```

**Manual/CLI** (runs the same commands Cloudflare runs) still works:

```bash
npm run deploy            # production  (= npm run build && wrangler deploy)
npm run deploy:staging    # staging     (= … && wrangler deploy --env staging)
```

## Promoting staging → production

Both environments build from the same commit graph, so promotion is a
fast-forward merge and a push:

```bash
git checkout main
git merge --ff-only develop
git push origin main        # ← triggers the production deploy
git checkout develop
```

## Feature-branch previews

Each Worker only auto-**deploys** its own production branch. Pushing any *other*
branch triggers a **preview build** (Cloudflare runs `npx wrangler versions
upload`, giving a temporary versioned preview URL) without touching the live
environment. Toggle this per Worker under **Settings → Builds → Non-production
branches**.

## Rollback

Every deploy is a Worker **version**. In the dashboard → the Worker →
**Deployments**, pick a previous version and **Rollback** — instant, no rebuild.
Or push a revert commit to the branch to redeploy the previous state.

## Verifying a deploy

```bash
# Production indexable, staging not:
curl -s https://goodwebtools.com/ | grep -o '<meta name="robots"[^>]*>'            # → index, follow
curl -s https://goodwebtools-staging.workers.dev/ | grep -o '<meta name="robots"[^>]*>'  # → noindex, nofollow

# Models serve from R2 (200):
curl -sI https://goodwebtools.com/models/lama/lama_fp32.onnx | head -1             # → HTTP/2 200
```

Analytics: `SITE_GA_ID` is inlined in the production HTML and absent in staging.

## Notes & troubleshooting

- **`wrangler deploy` needs the R2 bucket to exist** — create it first, or the
  deploy fails on the `MODELS` binding.
- **Per-file asset limit is 25 MB.** Site WASM (mupdf ~10 MB, libarchive ~1 MB)
  is fine; large ML models go to R2 to avoid this. onnxruntime-web's ~26 MB wasm
  is emitted into `dist/_astro` but unused (ORT loads from `/models/ort/`); the
  `postbuild` step (`scripts/prune-dist.mjs`) removes it so deploys stay under the
  limit.
- **Node heap:** the asset-heavy build sets `--max-old-space-size=8192` in the
  `build` script (via `cross-env`) so Cloudflare's build doesn't OOM.
- **Peer deps:** `.npmrc` sets `legacy-peer-deps=true` so `npm ci` resolves the
  tfjs/upscaler peer conflict on Cloudflare.
- **Model versions must match.** `@imgly/background-removal` and its `-data`
  package are pinned together; a mismatch causes "Resource … not found".
- **404s / routing:** Astro emits `dist/tools/<id>/index.html`; Cloudflare serves
  trailing-slash variants and uses `dist/404.html`
  (`not_found_handling: "404-page"`).
- **Secrets:** none are committed. Wrangler auth is `wrangler login` or the
  `CLOUDFLARE_API_TOKEN` env var; `.dev.vars`, `.env*`, and `.wrangler/` are
  gitignored.

## Cost

Cloudflare's free tier covers this comfortably: Static Assets have unlimited
bandwidth, and R2 has a generous free tier for storage + egress (models are
immutable and hard-cached, so they download once per visitor).

## Deploy your own instance

GoodWebTools is self-hostable on Cloudflare Workers. To run your own copy:

1. **Fork** this repo and clone it.
2. **Rename the deployment identifiers** in `wrangler.jsonc` (`name`,
   `env.staging.name`) and the R2 bucket names to values you own.
3. **Create the R2 buckets** (production + `-staging`, step 1 above).
4. **Point branding at your domain** in `src/config.ts` (`SITE_URL`, `REPO_URL`)
   and `astro.config.mjs` (`site`); update `public/robots.txt`.
5. **(Optional) analytics:** set `SITE_GA_ID` as a production build variable.
6. **Stage & upload the models:** `npm run stage:models` then `npm run sync:r2`.
7. **Connect Workers Builds** to your fork (production branch `main`) and push.

Nothing sends data anywhere except your own Cloudflare account.
