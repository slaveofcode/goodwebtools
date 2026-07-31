---
name: gwt-add-tool
description: Use when adding a new tool to GoodWebTools (gwt) or improving/fixing an existing one. Runs the full flow — brainstorm → spec → plan → TDD build → verify loop → ship (PR to develop → promote develop→main → confirm production) — with this repo's conventions baked in (tool registry, thin-island/pure-lib split, Vitest patterns, Cloudflare deploy, gh admin-merge).
---

# GoodWebTools: Add or Improve a Tool

The end-to-end workflow for shipping a change to GoodWebTools — from idea to live on production (goodwebtools.com) — plus the repo-specific conventions that make each step concrete. Follow the phases in order. For a small bug fix, the brainstorm/spec phases collapse to a sentence, but every code change still goes through the **verify loop** and the **ship** flow.

**Announce at start:** "Using the gwt-add-tool skill to <add|improve> <thing>."

## Phase 0 — Decide the shape

- **New tool or improvement?** Both use this skill.
- **How big?** A genuinely new capability (new UI + logic) → do the full brainstorm→spec→plan. A bug fix or small UX tweak → skip to Phase 3 (build) with a one-line plan, but still write a failing test first and run the full verify loop + ship flow.
- **Ask the user** for the substantive product decisions (scope, output format, placement) via AskUserQuestion — don't assume. One question at a time.

## Phase 1 — Brainstorm → spec (new capability)

Invoke `superpowers:brainstorming`. Present 2–3 approaches with a recommendation; get approval section by section. Save the spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, self-review, and have the user review before planning.

Bias for GWT: **everything runs client-side** (privacy-first) — prefer WASM/on-device over any server call. If an approach needs a server, flag it as breaking the product's core promise.

## Phase 2 — Plan

Invoke `superpowers:writing-plans`. Save to `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. Task granularity: **one pure lib (with tests) per task, thin islands last.** Verify real APIs while writing the plan (component props, lucide icon names, existing lib signatures) so every code block is accurate, not guessed.

## Phase 3 — Build (TDD, inline)

Invoke `superpowers:executing-plans` for a multi-task plan. Per task: **failing test → run (confirm fail) → implement → run (confirm pass).** Hold or make commits per the user's instruction for the session (they often say "don't commit until I tell you" or "ship it").

### GWT architecture conventions (follow these exactly)

- **Tool registry** — `src/registry/tools.ts`. Add a `ToolDef`: `{ id, name, category, route: '/tools/<id>', keywords: [...], icon, summary, load: () => import('@/islands/<cat>/<Comp>'), status: 'beta' | 'stable' }`. Import the `icon` from `lucide-react` (verify it exists: `ls node_modules/lucide-react/dist/esm/icons/<kebab>.js`). New tools start `status: 'beta'`.
- **No per-tool page** — the dynamic route `src/pages/tools/[tool].astro` serves every registry entry via `ToolHost`. Registering is enough.
- **Categories** — `Dev`, `PDF`, `Image`, `Files`, `Draw`, `Media`, `Playground`.
- **Thin island, pure libs** — UI in `src/islands/<category>/<Name>.tsx` (default export). All real logic in `src/tools/<category>/<name>.lib.ts` (pure, framework-free) and unit-tested. Hooks in `src/hooks/`. Islands are covered by build + manual smoke, not unit tests.
- **Reuse shared UI/services** — `Dropzone`, `Button`, `Alert`, `TextArea`, `ProgressBar` (determinate; use a plain busy indicator for indeterminate work), `CopyButton`, `CopyImageButton`, `ImageResult`, `EditInAnnotatorButton`, `ResultActions`; `usePasteImage` (paste), `downloadService.download(blob, name)`, `clipboardService`. Don't re-implement these.
- **Heavy deps (WASM/ML)** — dynamic-import them inside the lib so the island chunk stays small (e.g. `onnxruntime-web`, `mupdf`, `ppu-paddle-ocr`, `pdfjs` via `render.lib`). Add their built chunk globs to `workbox.globIgnores` in `astro.config.mjs` so they don't bloat the PWA precache. Models/wasm are runtime-fetched, not bundled.
- **Desktop-only tools** — set `desktopOnly: true` in the ToolDef; the Tauri gate (`html.tauri`) hides them on web.
- **SSR safety** — no `window`/`navigator`/`document` at module scope; guard with `typeof window !== 'undefined'` and only touch them in effects/handlers.

### GWT test conventions (Vitest)

- Pure transforms: build plain `ImageData`/data objects in jsdom (no real canvas) — see `src/tools/image/mono.lib.test.ts`.
- Heavy deps & browser APIs: `vi.mock(...)` / `Object.defineProperty(global.navigator, ...)` — see `src/services/capture/*.test.ts`.
- Hooks: `renderHook`/`act` from `@testing-library/react` (already a devDependency).
- Table-driven with `it.each` for parsers/formatters.

## Phase 4 — Verify loop (do not skip)

Run all three and **fix until green** — this is where real bugs surface that tests didn't:

```bash
npx vitest run          # whole suite green
npm run lint            # 0 errors (warnings are tolerated by repo config; no `any` in new source)
npm run build           # succeeds; new /tools/<id> page built; no precache-size warning for a new heavy chunk
```

Then **review by hand** for the classes of bug tests miss: resource leaks (streams/workers/objectURLs released on every path), reference-identity churn (memoize derived props passed to children so edits don't reset — a real bug we hit), SSR access, and error/empty-input paths. If the change touches `src-tauri/**`, the `desktop-check` CI (3-OS `cargo check`) also runs.

## Phase 5 — Ship (dev → production)

`gh` on this repo requires `env -u GITHUB_TOKEN` (see below). Deploy topology: **`develop` → staging** (`goodwebtools-staging.workers.dev`), **`main` → production** (`goodwebtools.com`), both via Cloudflare Workers Builds. `main` is branch-protected (needs the CI check + review) → use `--admin` to promote.

```bash
# 1. Commit on a feature branch (feat/… or fix/…), off the latest develop (or main for a hotfix).
git checkout -b feat/<slug>
git add <paths> && git commit -m "feat(<scope>): …

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"

# 2. Push + open PR to develop.
git push -u origin feat/<slug>
env -u GITHUB_TOKEN gh pr create --base develop --head feat/<slug> --title "…" --body "…"

# 3. Wait for CI ("Test · Build · Lint"), then merge.
env -u GITHUB_TOKEN gh pr checks <n>
env -u GITHUB_TOKEN gh pr merge <n> --merge --delete-branch
git checkout develop && git fetch origin develop -q && git reset --hard origin/develop

# 4. Promote develop → main (production). main is protected → --admin.
env -u GITHUB_TOKEN gh pr create --base main --head develop --title "Promote to production: …" --body "…"
env -u GITHUB_TOKEN gh pr merge <n> --merge --admin

# 5. Confirm the production Cloudflare build, then verify the live URL.
git checkout main && git fetch origin main -q && git reset --hard origin/main
SHA=$(git rev-parse HEAD)
# poll: .check_runs[] | select(.name=="Workers Builds: goodwebtools") | .status == "completed", .conclusion == "success"
env -u GITHUB_TOKEN gh api "repos/slaveofcode/goodwebtools/commits/$SHA/check-runs" \
  -q '.check_runs[] | select(.name=="Workers Builds: goodwebtools") | .status + "/" + (.conclusion // "pending")'
```

Then verify the live page with WebFetch (`https://goodwebtools.com/tools/<id>` loads, correct heading) — **the deploy is not "done" until the live URL is confirmed.**

Long waits (CI, Cloudflare build) → use a backgrounded Bash `until` poll so you're notified on completion instead of blocking.

### Post-deploy notes

- The site is a **PWA with a service worker** — tell the user to hard-refresh (or close all tabs) to pick up new JS; cached model/wasm files persist.
- **Desktop app** ships separately: bump the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, AND `src-tauri/Cargo.lock` (all three), update `CHANGELOG.md`, then tag `desktop-v<version>` on `main` → `release.yml` builds/signs → publish the draft. Not part of the web deploy.

## Gotchas (learned the hard way)

- **`gh` auth:** always prefix with `env -u GITHUB_TOKEN` on this repo, or it uses the wrong token/scope.
- **Verify the whole PR landed:** before merging, compare `gh pr view <n> --json headRefOid` to local `HEAD` — pushes during testing don't always all land.
- **Cloudflare build cache** can serve stale inlined env values; if an env-driven change doesn't take effect, Clear Cache in the Workers build settings.
- **Peer-dep conflicts** are handled by the committed `.npmrc` (`legacy-peer-deps=true`); the build uses `cross-env NODE_OPTIONS=--max-old-space-size=8192` (asset-heavy build OOMs otherwise).
- **`ProgressBar` is determinate-only** (`percent` required) — use a plain busy line for indeterminate work.
- **Register-then-build:** a new tool 404s until it's in `src/registry/tools.ts`.

## Definition of done

Spec+plan committed under `docs/superpowers/` · new/changed logic unit-tested · full suite + lint + build green · merged to develop · promoted to main · **Cloudflare production build succeeded AND the live `goodwebtools.com/tools/<id>` URL verified** · user told about the PWA hard-refresh.
