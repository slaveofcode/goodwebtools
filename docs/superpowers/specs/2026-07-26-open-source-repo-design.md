# Open-Sourcing GoodWebTools — Design

**Status:** Approved (2026-07-26)
**Goal:** Take the currently-private `slaveofcode/goodwebtools` repo public with a clean history, genericized (self-hostable) infrastructure, full community-contribution scaffolding, and PR CI — without disrupting the live Cloudflare deploy.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Repo strategy | **Make this repo public in-place** + purge `main` history to a single commit |
| Owner infra | **Genericize + self-hostable** (externalize owner values, keep deploy working) |
| Internal planning docs | **Move to a `design-history` branch** (off `main`) |
| License | **MIT** |
| Contributor CI | **test + build + lint** on PRs |
| Discussions | **Enabled** |
| Desktop `release.yml`/updater | **Kept + documented** as owner-specific (not removed) |

## Constraints / invariants

- **The live site must never break.** Production (`main`) and staging (`develop`) deploy via Cloudflare Workers Builds on push; the repo must remain deployable at every step.
- **Nothing sensitive is ever exposed publicly.** History purge + infra cleanup complete *before* the repo flips to public. (History is already secret-free — verified: no `.env`, keys, or tokens ever committed — so the purge is for clean presentation, not remediation.)
- **Genericize, don't break.** Owner-specific values that aren't secrets (bucket names, domain, updater pubkey, worker names) stay concrete but documented as "change for your own deploy." Only the GA measurement ID moves to an env var (so forks don't report to the owner's Analytics property).
- Full pre-purge history is preserved in a **private** `git bundle` (recoverable), never published.

---

## Component A: History, branches & backup

### A1. Private safety backup (before anything destructive)
`git bundle create ../goodwebtools-full-history-<stamp>.bundle --all` → a single-file, complete copy of all 426 commits + refs, stored outside the repo (private). Recoverable via `git clone <bundle>`. Optionally also push all refs to a private backup remote. This is insurance only; not published.

### A2. `design-history` branch (public, clean)
A single **orphan** commit containing only the internal planning artifacts:
- `docs/superpowers/**` (specs + plans)
- `plan.md` (root)
- A short `README.md` on that branch explaining it holds design history.

Created via `git checkout --orphan design-history` → keep only those paths → one commit → push. This preserves the planning docs (linkable at `tree/design-history`) without publishing the messy 426-commit history or AI co-author trailers.

### A3. Squash `main` to a single commit
After all cleanup (B/C/D) is merged to `main` and the deploy is verified:
- `git checkout --orphan public-main` at `main`'s tree → single commit `chore: initial public release`, authored by the owner, **no `Co-Authored-By` trailers** → replace `main` → force-push.
- `develop` is reset to match `main` (single commit) so the two branches share the clean base going forward.

### A4. Tag `desktop-v1.0.0-beta.1`
Deleted locally and on origin (`git push origin :refs/tags/desktop-v1.0.0-beta.1`), and its draft GitHub Release removed. It points at soon-to-be-purged commits and never published assets (billing-blocked). Desktop can be re-tagged fresh from the new history later.

**Interface — Produces:** a clean public `main` (1 commit), a public `design-history` branch, a private history bundle. **Consumes:** the fully-cleaned tree from B/C/D.

---

## Component B: Infra genericization

Each change keeps the owner's deploy working while making the repo fork-friendly.

### B1. `astro.config.mjs` — GA ID → env
Replace the hardcoded `const PROD_GA_ID = 'G-4Q9F8CL7FW'` with `const PROD_GA_ID = process.env.SITE_GA_ID || ''`. The existing branch-gating stays: on Workers Builds `main` builds, GA loads **only if** `SITE_GA_ID` is set; other branches and forks get none.
- **Owner action (documented):** set `SITE_GA_ID=G-4Q9F8CL7FW` as a **production build variable** in the production Worker's Workers Builds config. (One small dashboard var; GA IDs are already public in page-source, so this isn't about secrecy — it's so forks don't inherit the owner's property.)

### B2. `wrangler.jsonc` — document, keep concrete
Worker names (`goodwebtools`, `goodwebtools-staging`) and R2 bucket names stay concrete (Workers Builds reads them directly). Add a top-of-file comment block: "These names are specific to this deployment — rename them (and create your own R2 buckets) to self-host." No functional change.

### B3. Domain / branding — document
`src/config.ts` (`SITE_URL`, `REPO_URL`), `public/robots.txt`, `astro.config.mjs` `site` keep `goodwebtools.com` / `slaveofcode`. Add a note in the self-hosting docs that these are the canonical owner values to change for a fork. (No env indirection — keeps SSG canonical/OG/sitemap simple; forks edit `config.ts`.)

### B4. Desktop (`tauri.conf.json`, `release.yml`, `RELEASING-DESKTOP.md`) — keep + document
Updater `pubkey` (public-safe), `endpoints` (owner's releases), and the signing workflow (uses `secrets.*` a fork supplies) are kept. `RELEASING-DESKTOP.md` gains a "these are owner-specific; a fork sets its own signing key + endpoints" note. The private signing key is **not** in the repo (already only referenced via `secrets.*`).

### B5. Scripts / `.npmrc` — unchanged
`stage-models.mjs`, `sync-r2.mjs`, `copy-wasm.mjs`, `download-ffmpeg-binaries.mjs`, `.npmrc` (legacy-peer-deps) are all needed to build/run and are already generic (`sync-r2` reads bucket names from `wrangler.jsonc`). No change.

### B6. Deploy docs → self-hosting guide
`DEPLOYMENT.md` + `DEPLOYMENT-GIT.md` reframed with a **"Deploy your own instance"** section: create your Cloudflare account + Worker + R2 buckets, set `SITE_GA_ID` (optional), `stage:models` + `sync:r2`, connect Workers Builds. Owner-specific identifiers called out as "replace with yours."

---

## Component C: Community-health files + README

Created at repo root / `.github/`:
- **`LICENSE`** — MIT, `Copyright (c) 2026 <owner>`.
- **`CONTRIBUTING.md`** — prerequisites, `npm i --legacy-peer-deps`, `npm run dev`, `npm test`, lint/format, branch/PR flow (`develop` base), and a **"Add a new tool"** walkthrough of the registry pattern (`src/registry/tools.ts` `ToolDef` + island + `*.lib.ts` + tests) — the primary contributor on-ramp.
- **`CODE_OF_CONDUCT.md`** — Contributor Covenant v2.1, owner contact.
- **`SECURITY.md`** — private vulnerability disclosure (contact + scope: client-side/privacy focus).
- **`.github/ISSUE_TEMPLATE/`** — `bug_report.yml`, `feature_request.yml` (tool suggestions), `config.yml` (link to Discussions).
- **`.github/PULL_REQUEST_TEMPLATE.md`** — checklist (tests pass, lint clean, tool registered, no server assets touched).
- **`README.md` (rewritten, public-facing)** — one-liner + live URL, "privacy-first, runs in your browser" pitch, categorized tool list, tech stack (Astro + React islands, Tauri desktop), quickstart, **Add-a-tool** + **Self-hosting** + **Contributing** pointers, MIT badge, screenshots placeholder.

---

## Component D: Contributor CI

`.github/workflows/ci.yml`:
- **Triggers:** `pull_request` + `push` to `develop`/`main`.
- **Job (ubuntu, Node 20):** `npm ci` → `npm test -- --run` → `npm run build` → `npm run lint`.
- Build heap is already handled by the `build` script (`cross-env NODE_OPTIONS=--max-old-space-size=8192`). `.npmrc` handles peer deps for `npm ci`.
- No secrets required (pure verification), so it runs safely on fork PRs.

This is separate from `release.yml` (desktop) and does not deploy.

---

## Component E: Execution sequence (safety-ordered)

1. **Backup** — create the private history bundle (A1).
2. **`design-history` branch** — orphan-commit the internal docs, push (A2).
3. **Cleanup on `develop`** — apply B (genericize), C (community files + README), D (CI); remove `docs/superpowers/**` + `plan.md` from the working tree. Normal commits.
4. **Verify staging** — push `develop`; confirm Cloudflare staging build succeeds, `npm test`/`build`/`lint` green.
5. **Promote** — PR `develop`→`main`, merge; confirm **production** still deploys and GA loads (with `SITE_GA_ID` set in Cloudflare).
6. **Purge history** — squash `main` to one commit + force-push (A3); reset `develop` to match; delete the desktop tag/release (A4).
7. **Go public** — `gh repo edit --visibility public`.
8. **Repo settings** — Component F.

Steps 1–5 are reversible; the irreversible steps (6–7) happen only after the deploy is proven green on the cleaned tree.

---

## Component F: Repo settings & exposure

Via `gh` / dashboard, after going public:
- **Description** + **topics** (`astro`, `react`, `privacy`, `web-tools`, `client-side`, `tauri`, `pdf`, `image-tools`, `developer-tools`, `offline`).
- **Enable Issues + Discussions.**
- **Branch protection on `main`:** require the CI workflow to pass + 1 approving review; no direct pushes.
- Social-preview image (noted as a follow-up asset for the owner to upload).
- Launch checklist: verify links, live URL, CI badge renders, first "good first issue" labels.

---

## Success criteria

- Repo is public; `main` is a single clean commit; `design-history` holds the planning docs; full history recoverable from the private bundle.
- No owner GA ID or other owner-only value forces itself on forks; the owner's production site still builds, deploys, and reports to GA.
- A new contributor can: clone → `npm i --legacy-peer-deps` → `npm run dev`, read CONTRIBUTING, add a tool, open a PR, and see CI run.
- `npm test` (429), `npm run build`, `npm run lint` all green on `main`; CI passes on a test PR.
- Issues/Discussions open; `main` protected behind CI + review.

## Out of scope (YAGNI)

- Migrating deploys to a different provider or a second repo.
- A new desktop release (billing-blocked; separate effort).
- Marketing/launch posts, website redesign, logo/social-preview art (owner follow-up).
- Rewriting tool code for style; only infra/docs/scaffolding change here.
