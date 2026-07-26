# Deployment (Git-based auto-deploy, no GitHub Actions)

This guide sets up **push-to-deploy** with Cloudflare Workers Builds — Cloudflare
watches your GitHub branches directly and builds + deploys on every push. **No
GitHub Actions, no `wrangler` in CI you maintain.**

- Push to **`main`** → deploys **production** (`goodwebtools.com`).
- Push to **`develop`** → deploys **staging** (`goodwebtools-staging.workers.dev`).

> This is an alternative to the manual/CLI flow in [DEPLOYMENT.md](./DEPLOYMENT.md).
> The architecture (static `dist/` + a Worker that streams models from R2) and the
> one-time R2 model upload are identical — read those sections there first. This
> doc only covers the two-branch git wiring.

---

## How it maps

Two Cloudflare **Worker** services, both connected to the **same** GitHub repo,
each watching a different production branch:

| Environment | Worker service | Production branch | Deploy command | URL |
|-------------|----------------|-------------------|----------------|-----|
| Production  | `goodwebtools` | `main` | `npx wrangler deploy` | `goodwebtools.com` |
| Staging     | `goodwebtools-staging` | `develop` | `npx wrangler deploy --env staging` | `goodwebtools-staging.workers.dev` |

The `staging` environment is defined in [`wrangler.jsonc`](./wrangler.jsonc)
(`env.staging`, worker name `goodwebtools-staging`). It reuses the **same R2
bucket** — the ML models are immutable and safe to share between environments.

```
git push origin main     ─▶ Cloudflare Workers Builds ─▶ wrangler deploy              ─▶ production
git push origin develop  ─▶ Cloudflare Workers Builds ─▶ wrangler deploy --env staging ─▶ staging
```

---

## One-time setup

### 0. Prerequisites (shared with DEPLOYMENT.md)

- Create the R2 bucket and upload the model assets **once** (see
  [DEPLOYMENT.md → Upload the ML model assets to R2](./DEPLOYMENT.md#upload-the-ml-model-assets-to-r2)).
  Both environments read from the same bucket, so you only do this once.

### 1. Production Worker (branch `main`)

Cloudflare dashboard → **Workers & Pages → Create → Workers → Import a repository**:

1. Select the `slaveofcode/goodwebtools` repo.
2. **Worker name:** `goodwebtools`
3. **Production branch:** `main`
4. **Build command:** `npm run build`
5. **Deploy command:** `npx wrangler deploy`
6. **Build variables & secrets** (these are read at *build* time by Vite):
   - `PUBLIC_GA_ID` = your GA4 id, e.g. `G-XXXXXXXXXX` (omit to disable analytics)
   - leave `PUBLIC_NOINDEX` **unset** (production must be indexable)
7. Save & deploy. Then add the custom domain `goodwebtools.com` under the
   Worker's **Settings → Domains & Routes**.

### 2. Staging Worker (branch `develop`)

Repeat **Create → Import a repository** for the *same* repo, as a second Worker:

1. Select the same repo.
2. **Worker name:** `goodwebtools-staging`
3. **Production branch:** `develop`  ← the branch this Worker deploys
4. **Build command:** `npm run build`
5. **Deploy command:** `npx wrangler deploy --env staging`
6. **Build variables & secrets:**
   - **do not** set `PUBLIC_GA_ID` (no analytics on staging)
   - set `PUBLIC_NOINDEX` = `1` (emits `noindex` so staging stays out of search)
7. Save & deploy. It's reachable at `goodwebtools-staging.workers.dev` (or attach
   `staging.goodwebtools.com`).

That's it. From now on every push to `main` or `develop` auto-builds and deploys
the matching environment.

---

## Why `PUBLIC_*` variables go in the *build* settings

`PUBLIC_GA_ID` and `PUBLIC_NOINDEX` are consumed by `npm run build` (Vite inlines
`import.meta.env.PUBLIC_*` into the static output) — they are **not** Worker
runtime bindings. So they must be set as **Build variables** on each Worker's
Workers Builds configuration, and they differ per environment:

| Variable | Production (`main`) | Staging (`develop`) |
|----------|---------------------|---------------------|
| `PUBLIC_GA_ID` | your GA4 id | *(unset)* |
| `PUBLIC_NOINDEX` | *(unset)* | `1` |

Changing a build variable takes effect on the **next push/redeploy**.

---

## Feature-branch previews (optional)

Each Worker only auto-**deploys** its own production branch. Pushing any *other*
branch to a connected Worker triggers a **preview build** instead (Cloudflare runs
`npx wrangler versions upload`, giving a temporary versioned preview URL) without
touching the live environment. You can turn this off per Worker under **Settings
→ Builds → Non-production branches** if you don't want preview builds.

---

## Promoting staging → production

Because both environments build from the same commit graph, promotion is just a
fast-forward merge and a push:

```bash
git checkout main
git merge --ff-only develop
git push origin main        # ← triggers the production deploy
git checkout develop
```

---

## Verifying a deploy

- **Production indexable, staging not:**
  ```bash
  curl -s https://goodwebtools.com/            | grep -o '<meta name="robots"[^>]*>'
  # → index, follow
  curl -s https://goodwebtools-staging.workers.dev/ | grep -o '<meta name="robots"[^>]*>'
  # → noindex, nofollow
  ```
- **Analytics only in production:** `PUBLIC_GA_ID` is present in the production
  HTML and absent in staging (and it still only loads after cookie consent).
- **Models serve:** open a page that uses an AI tool and confirm `/models/…`
  returns `200` from R2 (see DEPLOYMENT.md troubleshooting).

---

## Rollback

Every deploy is a Worker **version**. In the dashboard → the Worker → **Deployments**,
pick a previous version and **Rollback** — instant, no rebuild. Or push a revert
commit to the branch to redeploy the previous state.

---

## Notes

- **Local manual deploys still work:** `npm run deploy` (production) and
  `npm run deploy:staging` (staging) run the same commands Cloudflare runs.
- **`wrangler.jsonc` is the single source of truth** for both environments; the
  staging worker name and bindings live under `env.staging`.
- **Secrets:** none are committed. `PUBLIC_*` build vars are configured in the
  Cloudflare dashboard per Worker; `.env`/`.dev.vars` stay local and gitignored.
