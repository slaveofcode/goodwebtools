# Open-Sourcing GoodWebTools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take `slaveofcode/goodwebtools` public with a clean single-commit history, genericized self-hostable infra, full contribution scaffolding, and PR CI — without disrupting the live Cloudflare deploy.

**Architecture:** Ops/docs work, not application code. Reversible prep (backup, branch, genericize, community files, CI) is verified on staging→production *first*; only then are the irreversible steps (history squash, go-public) performed. This is a `gh`/`git`-heavy plan; "verification" replaces "tests" for most tasks, plus the existing `npm test`/`build`/`lint` where code changes.

**Tech Stack:** git, GitHub CLI (`gh`), Astro/Vite build, Cloudflare Workers Builds (auto-deploy), GitHub Actions (CI + desktop release).

## Global Constraints

- **`gh` must be prefixed with `env -u GITHUB_TOKEN`** on this repo (the `GITHUB_TOKEN` env var lacks admin scope; the keyring token has it).
- **The live site must stay deployable at every step.** `main`=production, `develop`=staging, auto-deployed by Cloudflare Workers Builds on push.
- **Nothing sensitive reaches the public repo:** history purge + infra cleanup complete *before* visibility flips to public. History is already secret-free (verified — no `.env`/keys/tokens ever committed).
- **Genericize, don't break:** only the GA measurement ID moves to an env var (`SITE_GA_ID`). Other owner values (bucket/worker names, `goodwebtools.com`, updater pubkey) stay concrete but documented as owner-specific.
- **Irreversible steps (Tasks 11–12) require explicit human go-ahead** before running.
- Repo identity: `slaveofcode/goodwebtools`. Lint: `npm run lint` (`eslint src --ext .ts,.tsx,.astro`). Install: `npm i --legacy-peer-deps` (or `npm ci`, `.npmrc` sets legacy-peer-deps).
- Start on branch `develop`.

---

## File Structure

```
# NEW (community health + CI)
LICENSE                                  MIT
CONTRIBUTING.md                          contributor guide + "add a tool"
CODE_OF_CONDUCT.md                       Contributor Covenant v2.1
SECURITY.md                              private disclosure via GitHub advisories
.github/ISSUE_TEMPLATE/bug_report.yml
.github/ISSUE_TEMPLATE/feature_request.yml
.github/ISSUE_TEMPLATE/config.yml
.github/PULL_REQUEST_TEMPLATE.md
.github/workflows/ci.yml                 test + build + lint on PRs

# MODIFIED (genericize / document)
astro.config.mjs                         GA ID → process.env.SITE_GA_ID
wrangler.jsonc                           header comment: owner-specific, rename to self-host
.env.example                             document SITE_GA_ID
README.md                                rewritten public-facing
DEPLOYMENT.md / DEPLOYMENT-GIT.md        add "Deploy your own instance" section
RELEASING-DESKTOP.md                     note: owner-specific signing/endpoints

# REMOVED from main tree (preserved on design-history branch)
docs/superpowers/**                      internal specs + plans
plan.md                                  38KB internal planning

# GIT/REPO OPS (no file content)
git bundle (private backup) · design-history branch · squash main · delete desktop tag
gh repo edit --visibility public · topics · discussions · branch protection
```

---

## Task 1: Pre-flight backups & safety checks

**Files:** none (produces a private bundle outside the repo).

**Interfaces:** Produces `../goodwebtools-full-history.bundle` (recoverable full history). Consumes nothing.

- [ ] **Step 1: Confirm clean tree on develop**

Run: `git checkout develop && git status --short && git log --oneline -1`
Expected: no output from `status` (clean); on `develop`.

- [ ] **Step 2: Create the private full-history bundle (insurance)**

Run:
```bash
git bundle create ../goodwebtools-full-history.bundle --all
git bundle verify ../goodwebtools-full-history.bundle
```
Expected: `The bundle records a complete history` / `is okay`. This file is the recovery point for all 426 commits — keep it outside the repo (do NOT commit it).

- [ ] **Step 3: Confirm the Tauri signing key is backed up**

Run: `ls -la ~/.tauri/gwt-updater.key ~/.tauri/gwt-updater.key.pub`
Expected: both files exist. (User confirmed an external backup on 2026-07-26 — do not proceed to Task 11/12 otherwise.)

- [ ] **Step 4: Record the current remote refs (for reference)**

Run: `git ls-remote --heads --tags origin > ../goodwebtools-refs-before.txt && cat ../goodwebtools-refs-before.txt`
Expected: lists `main`, `develop`, `design-history` (later), and tag `desktop-v1.0.0-beta.1`. Kept as a private record; not committed.

---

## Task 2: Create the `design-history` branch (preserve internal docs)

**Files:** none in the working tree yet (operates on an orphan branch).

**Interfaces:** Produces a pushed `design-history` branch containing `docs/superpowers/**` + `plan.md` + a branch README. Consumes: Task 1 backup.

- [ ] **Step 1: Create an orphan branch and clear the index**

Run:
```bash
git checkout --orphan design-history
git rm -rf --quiet . 
```
Expected: working tree emptied from git's view (files remain on disk until next step overwrites the index).

- [ ] **Step 2: Restore only the internal planning artifacts from develop**

Run:
```bash
git checkout develop -- docs/superpowers plan.md
```
Expected: `docs/superpowers/` and `plan.md` staged.

- [ ] **Step 3: Add a branch README explaining its purpose**

Create `README.md` (on this branch only):
```markdown
# Design history

This branch preserves the internal design specs and implementation plans that
guided GoodWebTools' development (`docs/superpowers/`) plus the original
`plan.md`. It is kept off `main` for a clean public presentation. These are
historical planning artifacts, not current documentation — see `main` for the
project and its docs.
```
Run: `git add README.md`

- [ ] **Step 4: Commit and push the branch**

Run:
```bash
git commit -q -m "docs: preserve design specs and plans (design-history)"
git push -u origin design-history
```
Expected: branch pushed. Verify: `env -u GITHUB_TOKEN gh api repos/slaveofcode/goodwebtools/branches/design-history --jq .name` → `design-history`.

- [ ] **Step 5: Return to develop**

Run: `git checkout develop`
Expected: back on `develop`, all files intact.

---

## Task 3: Genericize the GA measurement ID

**Files:**
- Modify: `astro.config.mjs` (the `PROD_GA_ID` line)
- Modify: `.env.example`

**Interfaces:** Consumes: existing branch-gating in `astro.config.mjs`. Produces: GA loads on `main` builds only when `SITE_GA_ID` env is set (owner sets it in Cloudflare; forks get none).

- [ ] **Step 1: Replace the hardcoded ID with an env read**

In `astro.config.mjs`, change:
```js
const PROD_GA_ID = 'G-4Q9F8CL7FW';
```
to:
```js
// The production Google Analytics ID is provided by the deploy environment
// (SITE_GA_ID build var), not hard-coded — so forks never report to the
// upstream Analytics property. Owner sets SITE_GA_ID on the production build.
const PROD_GA_ID = process.env.SITE_GA_ID || '';
```
Leave the rest of the block (the `WORKERS_CI` / branch gating) unchanged.

- [ ] **Step 2: Document SITE_GA_ID in .env.example**

Append to `.env.example`:
```bash

# Production Google Analytics 4 ID, injected by the deploy env (e.g. Cloudflare
# build variable SITE_GA_ID). Consumed by astro.config.mjs on `main` builds.
# Leave unset to disable analytics. Local dev: set PUBLIC_GA_ID above instead.
SITE_GA_ID=
```

- [ ] **Step 3: Verify the production path still inlines GA when SITE_GA_ID is set**

Run:
```bash
SITE_GA_ID=G-4Q9F8CL7FW WORKERS_CI=1 WORKERS_CI_BRANCH=main npm run build > /tmp/ga-prod.log 2>&1; echo "exit:$?"
grep -rl "G-4Q9F8CL7FW" dist | wc -l
```
Expected: exit 0; count > 0 (GA inlined).

- [ ] **Step 4: Verify forks/no-var builds get NO GA**

Run:
```bash
WORKERS_CI=1 WORKERS_CI_BRANCH=main npm run build > /tmp/ga-nofork.log 2>&1; echo "exit:$?"
grep -rl "G-4Q9F8CL7FW" dist | wc -l
```
Expected: exit 0; count = 0 (no SITE_GA_ID → no GA, even on main).

- [ ] **Step 5: Commit**

```bash
git add astro.config.mjs .env.example
git commit -m "refactor(analytics): read production GA ID from SITE_GA_ID env

Removes the hard-coded measurement ID from the source so public forks don't
report to the upstream Analytics property. Owner sets SITE_GA_ID as a Cloudflare
production build variable."
```

> **Owner action (out-of-band, before/at go-live):** set `SITE_GA_ID=G-4Q9F8CL7FW` as a **production build variable** in the production Worker's Workers Builds settings, so the live site keeps reporting analytics.

---

## Task 4: Document owner-specific infra (wrangler, desktop, deploy docs)

**Files:**
- Modify: `wrangler.jsonc` (header comment)
- Modify: `RELEASING-DESKTOP.md` (owner-specific note)
- Modify: `DEPLOYMENT.md` (add "Deploy your own instance" section)

**Interfaces:** Consumes: nothing. Produces: fork-facing documentation. No functional/deploy change.

- [ ] **Step 1: Add a self-host header comment to wrangler.jsonc**

At the very top of `wrangler.jsonc` (before the opening `{`), JSONC allows a leading comment — insert:
```jsonc
// NOTE: The worker names, R2 bucket names, and domain below are specific to the
// upstream GoodWebTools deployment. To self-host, rename them to your own (and
// create your own R2 buckets — see DEPLOYMENT.md "Deploy your own instance").
```
(Keep all existing config unchanged.)

- [ ] **Step 2: Verify wrangler.jsonc still parses**

Run: `node -e "const fs=require('fs');JSON.parse(fs.readFileSync('wrangler.jsonc','utf8').replace(/^\s*\/\/.*$/gm,''));console.log('valid')"`
Expected: `valid`.

- [ ] **Step 3: Add an owner-specific note to RELEASING-DESKTOP.md**

At the top of `RELEASING-DESKTOP.md`, after the first heading, insert:
```markdown
> **Self-hosting note:** The signing key, GitHub secrets, and updater endpoints
> below are specific to the upstream release. A fork building its own desktop
> app must generate its own signing key (`npm run tauri -- signer generate`),
> set its own `TAURI_SIGNING_PRIVATE_KEY` secret, and point the updater endpoints
> in `src-tauri/tauri.conf.json` at its own releases. The upstream private key is
> never in this repo.
```

- [ ] **Step 4: Add a "Deploy your own instance" section to DEPLOYMENT.md**

Append to `DEPLOYMENT.md`:
```markdown

## Deploy your own instance

GoodWebTools is self-hostable on Cloudflare Workers. To run your own copy:

1. **Fork** this repo and clone it.
2. **Rename the deployment identifiers** in `wrangler.jsonc` (`name`,
   `env.staging.name`) and the R2 bucket names to values you own.
3. **Create the R2 buckets:**
   `npx wrangler r2 bucket create <your-bucket>` (and a `-staging` one).
4. **Point branding at your domain** in `src/config.ts` (`SITE_URL`, `REPO_URL`)
   and `astro.config.mjs` (`site`); update `public/robots.txt`.
5. **(Optional) analytics:** set `SITE_GA_ID` as a production build variable
   (Workers Builds → Settings → Build). Leave unset to disable.
6. **Stage & upload the ML models to R2:** `npm run stage:models` then
   `npm run sync:r2` (see the section above).
7. **Connect Workers Builds** to your fork (production branch `main`, build
   command `npm run build`) and push.

Nothing sends data anywhere except your own Cloudflare account.
```

- [ ] **Step 5: Commit**

```bash
git add wrangler.jsonc RELEASING-DESKTOP.md DEPLOYMENT.md
git commit -m "docs: mark owner-specific infra and add self-hosting guide"
```

---

## Task 5: Add the license and community-health files

**Files:**
- Create: `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:** Consumes: nothing. Produces: the files GitHub surfaces in its community-health UI.

- [ ] **Step 1: Create `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026 slaveofcode

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Create `CODE_OF_CONDUCT.md`**

Write the **verbatim Contributor Covenant v2.1** (canonical source: https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md), with the single enforcement-contact line set to:
```markdown
reported to the community leaders responsible for enforcement via GitHub's
private vulnerability reporting on this repository, or by opening a confidential
report to the maintainers.
```
(No email is published; enforcement routes through GitHub. The rest of the document is the standard Covenant text, unmodified.)

- [ ] **Step 3: Create `SECURITY.md`**

```markdown
# Security Policy

GoodWebTools runs entirely in the browser — files never leave your device — so
the attack surface is small, but we take reports seriously.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use
GitHub's **private vulnerability reporting**:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue and reproduction steps.

We aim to acknowledge reports within a few days. Once a fix ships, we're happy
to credit you (unless you prefer to remain anonymous).

## Supported versions

The latest deployed version (`main`) is supported. There are no long-term
support branches.
```

- [ ] **Step 4: Create `.github/ISSUE_TEMPLATE/bug_report.yml`**

```yaml
name: Bug report
description: Something in a tool is broken or behaves unexpectedly
labels: ["bug"]
body:
  - type: input
    id: tool
    attributes:
      label: Which tool?
      placeholder: e.g. Image Compressor, DB Diagram, PDF to Image
    validations:
      required: true
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: What did you do, what did you expect, what happened instead?
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: Steps to reproduce
      placeholder: |
        1. Open the tool
        2. Drop file X
        3. Click Y
  - type: input
    id: env
    attributes:
      label: Browser / OS
      placeholder: e.g. Chrome 130 on macOS 15
  - type: textarea
    id: console
    attributes:
      label: Console errors (if any)
      description: Open DevTools → Console and paste any errors.
      render: shell
```

- [ ] **Step 5: Create `.github/ISSUE_TEMPLATE/feature_request.yml`**

```yaml
name: Feature or tool request
description: Suggest a new tool or an improvement
labels: ["enhancement"]
body:
  - type: textarea
    id: idea
    attributes:
      label: What would you like?
      description: Describe the tool or improvement and the problem it solves.
    validations:
      required: true
  - type: checkboxes
    id: constraints
    attributes:
      label: Fits the project?
      options:
        - label: This can work fully client-side (no server / no data leaving the browser)
          required: true
  - type: textarea
    id: notes
    attributes:
      label: Anything else?
      description: Prior art, links, or libraries that could help.
```

- [ ] **Step 6: Create `.github/ISSUE_TEMPLATE/config.yml`**

```yaml
blank_issues_enabled: false
contact_links:
  - name: Questions & ideas (Discussions)
    url: https://github.com/slaveofcode/goodwebtools/discussions
    about: Ask questions or discuss ideas before filing an issue.
```

- [ ] **Step 7: Create `.github/PULL_REQUEST_TEMPLATE.md`**

```markdown
## What does this PR do?

<!-- A short description. Link any related issue: Closes #123 -->

## Checklist

- [ ] `npm test -- --run` passes
- [ ] `npm run build` succeeds
- [ ] `npm run lint` is clean
- [ ] New tool? It's registered in `src/registry/tools.ts` with an island + tests
- [ ] No owner-specific deploy assets changed (wrangler bucket names, secrets, domain)
- [ ] Everything still runs fully client-side (no data leaves the browser)
```

- [ ] **Step 8: Commit**

```bash
git add LICENSE CODE_OF_CONDUCT.md SECURITY.md .github/ISSUE_TEMPLATE .github/PULL_REQUEST_TEMPLATE.md
git commit -m "docs: add MIT license and community-health files"
```

---

## Task 6: Write `CONTRIBUTING.md` (with the add-a-tool on-ramp)

**Files:** Create: `CONTRIBUTING.md`

**Interfaces:** Consumes: existing registry pattern (`src/registry/tools.ts`, `src/types/tool.ts`). Produces: the contributor entry point.

- [ ] **Step 1: Create `CONTRIBUTING.md`**

```markdown
# Contributing to GoodWebTools

Thanks for wanting to help! GoodWebTools is a collection of privacy-first tools
that run entirely in the browser. Contributions — new tools, fixes, docs — are
welcome.

## Setup

```bash
git clone https://github.com/slaveofcode/goodwebtools
cd goodwebtools
npm install --legacy-peer-deps   # a peer-dep conflict (tfjs/upscaler) needs this
npm run dev                      # http://localhost:4321
```

Some tools need ML model files staged locally: `npm run stage:models`.

## Checks (run before opening a PR)

```bash
npm test -- --run    # unit tests (Vitest)
npm run build        # production build
npm run lint         # ESLint
```

CI runs all three on every PR.

## Branching

- Base your work on `develop` (not `main`). Open PRs against `develop`.
- Keep PRs focused; one tool or fix per PR.

## Adding a new tool

Tools are self-registering. To add one:

1. **Pure logic** → `src/tools/<category>/<name>.lib.ts` with Vitest tests
   (`<name>.lib.test.ts`). Keep DOM/canvas out of the pure functions so they're
   testable.
2. **UI island** → `src/islands/<category>/<Name>.tsx`, a default-exported React
   component with **no required props**. Use the shared UI (`Dropzone`,
   `ImageResult`/`ResultActions`, `usePasteImage`, etc.).
3. **Register it** in `src/registry/tools.ts` — append a `ToolDef`:
   ```ts
   {
     id: 'my-tool',
     name: 'My Tool',
     category: 'Image',            // Dev | PDF | Image | Files | Draw | Media | Playground
     route: '/tools/my-tool',
     keywords: ['...'],
     icon: SomeLucideIcon,
     summary: 'One-line description',
     load: () => import('@/islands/image/MyTool'),
     status: 'stable',
   }
   ```
   The route and page are generated automatically from the registry.

That's it — no routing or page files to touch.

## Principles

- **Client-side only.** No servers, no uploads; user data never leaves the browser.
- **Follow existing patterns.** Match the surrounding code's style and structure.
- **Test the logic.** Pure `*.lib.ts` functions get unit tests.

## Reporting bugs / ideas

Use the issue templates, or start a [Discussion](https://github.com/slaveofcode/goodwebtools/discussions).
By contributing you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).
```

- [ ] **Step 2: Sanity-check the referenced categories are accurate**

Run: `grep -oE "'(Dev|PDF|Image|Files|Draw|Media|Playground)'" src/types/tool.ts | sort -u`
Expected: the seven categories listed in the doc. Fix the doc if the set differs.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING with add-a-tool guide"
```

---

## Task 7: Rewrite `README.md` (public-facing)

**Files:** Modify: `README.md`

**Interfaces:** Consumes: tool registry (for the tool list), the new community files. Produces: the repo's landing page.

- [ ] **Step 1: Replace README.md with a public-facing version**

```markdown
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
```

- [ ] **Step 2: Verify no stale internal links remain**

Run: `grep -nE "docs/superpowers|plan\.md" README.md || echo "clean"`
Expected: `clean` (the public README must not link to the removed internal docs).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for public audience"
```

---

## Task 8: Add contributor CI workflow

**Files:** Create: `.github/workflows/ci.yml`

**Interfaces:** Consumes: `npm ci`, `npm test`, `npm run build`, `npm run lint`. Produces: a required status check for branch protection (Task 12).

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  verify:
    name: Test · Build · Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Test
        run: npm test -- --run
      - name: Build
        run: npm run build
      - name: Lint
        run: npm run lint
```
(No `NODE_OPTIONS` needed — the `build` script already sets `--max-old-space-size=8192` via `cross-env`. `npm ci` respects `.npmrc`'s `legacy-peer-deps`.)

- [ ] **Step 2: Validate the workflow YAML locally**

Run: `node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')" && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('yaml ok')"`
Expected: `yaml ok` (or, if no python3/yaml, confirm indentation matches the block above).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run test, build, and lint on pull requests"
```

---

## Task 9: Remove internal planning docs from the main tree

**Files:** Delete from working tree: `docs/superpowers/**`, `plan.md` (preserved on `design-history` from Task 2).

**Interfaces:** Consumes: Task 2 (docs already safe on `design-history`). Produces: a clean tree with no internal planning artifacts.

- [ ] **Step 1: Confirm the docs are safe on design-history first**

Run: `env -u GITHUB_TOKEN gh api repos/slaveofcode/goodwebtools/contents/plan.md?ref=design-history --jq .name`
Expected: `plan.md` (proves the branch has them before we delete on develop).

- [ ] **Step 2: Remove the internal docs**

Run:
```bash
git rm -r --quiet docs/superpowers
git rm --quiet plan.md
```
Expected: staged deletions. (Note: this plan file lives under `docs/superpowers/plans/` and is itself removed here — it remains on `design-history` and in your local checkout of that branch.)

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: move internal design specs/plans to design-history branch"
```

---

## Task 10: Verify on develop, then promote to main (staging → production)

**Files:** none (verification + merge).

**Interfaces:** Consumes: Tasks 3–9. Produces: a cleaned, deploy-verified `main`.

- [ ] **Step 1: Full local verification**

Run:
```bash
npm test -- --run 2>&1 | tail -3
npm run build > /tmp/final-build.log 2>&1; echo "build exit:$?"
npm run lint 2>&1 | tail -5; echo "lint exit:$?"
```
Expected: tests pass (429); build exit 0; lint exit 0.

- [ ] **Step 2: Push develop → verify staging deploy**

Run: `git push origin develop`
Then in the Cloudflare dashboard (or `env -u GITHUB_TOKEN gh api ...` if wired) confirm the **staging** Workers Build succeeds. Expected: green build; staging site serves (`curl -sI https://<staging-url>/ | head -1` → `HTTP/2 200`).

- [ ] **Step 3: Open and merge develop → main**

Run:
```bash
env -u GITHUB_TOKEN gh pr create --base main --head develop \
  --title "chore: prepare repo for open-source (docs, CI, genericized infra)" \
  --body "Community files, contributor CI, GA ID → SITE_GA_ID, self-hosting docs, internal docs moved to design-history. History purge + go-public follow separately."
env -u GITHUB_TOKEN gh pr merge --merge   # use the PR number printed above if prompted
```
Expected: merged.

- [ ] **Step 4: Verify production still deploys and GA works**

Confirm the **production** Workers Build (from `main`) succeeds. With `SITE_GA_ID` set in the production build vars, GA should load. Expected: `curl -s https://goodwebtools.com/ | grep -c "G-4Q9F8CL7FW"` → ≥1 (after the deploy completes and consent is granted in-browser; the ID is inlined in the HTML regardless).

- [ ] **Step 5: Sync local branches**

Run: `git fetch origin && git checkout main && git merge --ff-only origin/main && git checkout develop && git merge --ff-only origin/develop`
Expected: both fast-forward, in sync.

**STOP GATE:** Do not proceed to Task 11 until Steps 2 and 4 are confirmed green and a human has given explicit go-ahead for the irreversible history purge.

---

## Task 11: Purge history — squash `main` to one commit

**Files:** none (history rewrite). **⚠️ IRREVERSIBLE — requires explicit human go-ahead.**

**Interfaces:** Consumes: Task 10 (verified `main`), Task 1 (backup bundle). Produces: single-commit `main` + `develop`; deleted desktop tag.

- [ ] **Step 1: Re-confirm the backup exists**

Run: `git bundle verify ../goodwebtools-full-history.bundle | tail -1`
Expected: `is okay`. Abort if missing.

- [ ] **Step 2: Squash main to a single clean commit**

Run:
```bash
git checkout main && git pull --ff-only
git checkout --orphan public-main
git add -A
git commit -q -m "chore: initial public release

GoodWebTools — privacy-first, client-side web tools. See CONTRIBUTING.md."
git branch -M public-main main
```
Expected: `main` now has exactly one commit. Verify: `git log --oneline main | wc -l` → `1`. Confirm no AI trailers: `git log -1 --format='%an <%ae>%n%b' main` shows the owner and no `Co-Authored-By`.

- [ ] **Step 3: Force-push the rewritten main**

Run: `git push --force-with-lease origin main`
Expected: `+ ... main -> main (forced update)`. Cloudflare will rebuild production from the new HEAD (same tree → same deploy).

- [ ] **Step 4: Reset develop to match, force-push**

Run:
```bash
git checkout develop
git reset --hard main
git push --force-with-lease origin develop
```
Expected: `develop` now equals the single-commit `main`.

- [ ] **Step 5: Delete the desktop tag and its release**

Run:
```bash
git push origin :refs/tags/desktop-v1.0.0-beta.1 || true
git tag -d desktop-v1.0.0-beta.1 || true
env -u GITHUB_TOKEN gh release delete desktop-v1.0.0-beta.1 --yes --cleanup-tag || true
```
Expected: tag/release removed (ignore "not found" — it may have been a draft).

- [ ] **Step 6: Verify production deploy recovered**

Confirm the production Workers Build re-ran green on the new `main`. Expected: `curl -sI https://goodwebtools.com/ | head -1` → `HTTP/2 200`.

---

## Task 12: Go public + repo settings + branch protection

**Files:** none (`gh` repo settings). **⚠️ Going public is effectively irreversible (mirrors/indexing). Requires explicit human go-ahead.**

**Interfaces:** Consumes: Tasks 8 (CI check name `verify`), 11 (clean history). Produces: a public, contribution-ready repo.

- [ ] **Step 1: Flip visibility to public**

Run: `env -u GITHUB_TOKEN gh repo edit slaveofcode/goodwebtools --visibility public --accept-visibility-change-consequences`
Expected: no error. Verify: `env -u GITHUB_TOKEN gh repo view slaveofcode/goodwebtools --json visibility --jq .visibility` → `public`.

- [ ] **Step 2: Set description, homepage, and topics**

Run:
```bash
env -u GITHUB_TOKEN gh repo edit slaveofcode/goodwebtools \
  --description "Privacy-first daily-driver web tools that run entirely in your browser." \
  --homepage "https://goodwebtools.com"
env -u GITHUB_TOKEN gh repo edit slaveofcode/goodwebtools \
  --add-topic astro --add-topic react --add-topic privacy --add-topic web-tools \
  --add-topic client-side --add-topic tauri --add-topic pdf --add-topic image-tools \
  --add-topic developer-tools --add-topic offline
```
Expected: no error.

- [ ] **Step 3: Enable Issues and Discussions**

Run:
```bash
env -u GITHUB_TOKEN gh repo edit slaveofcode/goodwebtools --enable-issues --enable-discussions
```
Expected: no error. Verify Discussions: `env -u GITHUB_TOKEN gh repo view slaveofcode/goodwebtools --json hasDiscussionsEnabled --jq .hasDiscussionsEnabled` → `true`.

- [ ] **Step 4: Enable private vulnerability reporting**

Run: `env -u GITHUB_TOKEN gh api -X PUT repos/slaveofcode/goodwebtools/private-vulnerability-reporting`
Expected: 204 no content (enables the "Report a vulnerability" button SECURITY.md points to).

- [ ] **Step 5: Protect the `main` branch (require CI + review)**

Run:
```bash
env -u GITHUB_TOKEN gh api -X PUT repos/slaveofcode/goodwebtools/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["verify"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```
Expected: JSON describing the protection. (The status-check context `verify` matches the CI job name from Task 8; it becomes selectable once CI has run at least once — Step 6 triggers it.)

- [ ] **Step 6: Open a smoke-test PR to confirm CI runs**

Run:
```bash
git checkout develop && git checkout -b test/ci-smoke
git commit --allow-empty -m "test: trigger CI"
git push -u origin test/ci-smoke
env -u GITHUB_TOKEN gh pr create --base develop --head test/ci-smoke --title "test: CI smoke" --body "Verifying CI runs."
```
Watch: `env -u GITHUB_TOKEN gh pr checks test/ci-smoke --watch`
Expected: the `verify` job runs and passes. Then close + delete the branch:
```bash
env -u GITHUB_TOKEN gh pr close test/ci-smoke --delete-branch
git checkout develop
```

- [ ] **Step 7: Final public-readiness check**

Verify the community profile is complete:
```bash
env -u GITHUB_TOKEN gh api repos/slaveofcode/goodwebtools/community/profile --jq '.health_percentage, .files | keys'
```
Expected: high health percentage; keys include `code_of_conduct`, `contributing`, `license`, `readme`, `issue_template`, `pull_request_template`.

---

## Task 13: (Optional) Cut the desktop release post-public

**Files:** none (tag push triggers `release.yml`). Independent; can be deferred.

**Interfaces:** Consumes: Task 12 (public repo → free Actions), existing `TAURI_SIGNING_PRIVATE_KEY` secret + `release.yml`. Produces: a published GitHub Release with signed installers.

- [ ] **Step 1: Confirm signing secrets are set**

Run: `env -u GITHUB_TOKEN gh secret list --repo slaveofcode/goodwebtools | grep -i TAURI`
Expected: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` listed.

- [ ] **Step 2: Tag and push to trigger the release build**

Run:
```bash
git checkout main
git tag desktop-v1.0.0-beta.1
git push origin desktop-v1.0.0-beta.1
```
Expected: the `Release Desktop App` workflow starts (`env -u GITHUB_TOKEN gh run list --workflow=release.yml -L 1`).

- [ ] **Step 3: Watch the build and verify artifacts**

Run: `env -u GITHUB_TOKEN gh run watch $(env -u GITHUB_TOKEN gh run list --workflow=release.yml -L 1 --json databaseId --jq '.[0].databaseId')`
Expected: all four matrix jobs (macOS ×2, Windows, Linux) succeed. Then confirm the release has installers:
```bash
env -u GITHUB_TOKEN gh release view desktop-v1.0.0-beta.1 --json assets --jq '.assets[].name'
```
Expected: `.dmg` (×2), `.exe` (NSIS), `.deb`, and `latest.json`.

- [ ] **Step 4: Publish the release (if created as draft)**

Run: `env -u GITHUB_TOKEN gh release edit desktop-v1.0.0-beta.1 --draft=false --prerelease`
Expected: release is public + marked pre-release.

---

## Self-Review

**1. Spec coverage:**
- A1 backup + signing-key gate → Task 1. ✓
- A2 design-history branch → Task 2. ✓
- A3 squash main → Task 11. ✓
- A4 delete desktop tag + re-cut → Tasks 11.5, 13. ✓
- B1 GA→SITE_GA_ID → Task 3. ✓
- B2 wrangler doc → Task 4. ✓ · B3 domain doc → Task 4 (DEPLOYMENT self-host) + noted. ✓ · B4 desktop doc → Task 4. ✓ · B5 scripts unchanged → (no task needed, explicitly untouched). ✓ · B6 self-hosting guide → Task 4. ✓
- C license + community files → Tasks 5, 6; README → Task 7. ✓
- D CI → Task 8. ✓
- E sequencing (staging→prod before purge, then public) → Tasks 9→10→11→12, with STOP GATE. ✓
- F repo settings/branch protection/discussions → Task 12. ✓
- E9 desktop release → Task 13. ✓

**2. Placeholder scan:** No "TBD/TODO". The CoC step references the canonical Contributor Covenant v2.1 (a fixed standard document) with an exact enforcement-contact line — deterministic, not a placeholder. All file contents are complete.

**3. Consistency:** CI job name `verify` (Task 8) matches the branch-protection status-check context (Task 12 Step 5). `SITE_GA_ID` used identically in Task 3 (astro.config + .env.example) and the owner-action note + Task 10 verification. `design-history` branch created in Task 2 is the safety precondition checked in Task 9 Step 1. The backup bundle path `../goodwebtools-full-history.bundle` is consistent across Tasks 1 and 11. Repo slug `slaveofcode/goodwebtools` used throughout. ✓
