# Per-tool PWA install — design

**Date:** 2026-09-11
**Status:** design (approved in brainstorm; pending user review of this spec)

## Goal

Let a user install **any single GoodWebTools tool** as its own home-screen /
desktop app, so tapping the icon opens **straight into that one tool** (e.g. the
Markdown viewer) — a fast, app-like way to reach the tools they use often on a
phone, without installing a real app. Every tool is installable. Each installed
app has its **own distinct icon** and launches focused on its own tool.

Non-goals: an app store presence, push notifications, background sync, or any
server component. Everything stays client-side and offline-capable via the
existing service worker.

## Decisions (locked in brainstorm)

- **Scope:** every tool is installable (~190).
- **Install UI:** a dismissible inline **"Install this tool"** button in the tool
  header. Native prompt on Android/desktop; iOS shows Add-to-Home-Screen steps;
  hidden when already installed or dismissed.
- **Icons:** distinct **per-tool** icons generated at build from the tool's
  lucide glyph on a branded tile (192 + 512 maskable, 180 apple-touch).
- **App scope:** focused single-tool — `scope: /tools/<id>`; site-chrome links
  open in the normal browser.

## Background: what exists today

- **Service worker / PWA:** `@vite-pwa/astro` (`AstroPWA` in `astro.config.mjs`)
  with `registerType: 'autoUpdate'` and a `manifest: {...}` block for the global
  app. Workbox precaches the built assets (with `globIgnores` for heavy chunks).
- **Manifest link is hand-authored** in `src/layouts/Base.astro:114`
  (`<link rel="manifest" href="/manifest.webmanifest">`), plus
  `apple-mobile-web-app-*` metas and `apple-touch-icon`. This is the key enabler:
  we can make the linked manifest **per-page** without fighting the plugin.
- **Dynamic tool route:** `src/pages/[...locale]/tools/[tool].astro` renders every
  registry tool through `ToolHost`. It already knows the tool `id`, `name`,
  `category`, and `lang`.
- **Registry:** `src/registry/tools.ts` — each `ToolDef` has
  `{ id, name, category, route, icon (lucide component), summary, status }`.
- **Build-time asset scripts (the pattern to mirror):**
  - `scripts/generate-og.mjs` — satori (HTML→SVG) + `@resvg/resvg-js` (SVG→PNG),
    parses `tools.ts`, writes `public/og/<id>.png` per tool at prebuild.
  - `scripts/make-icons.mjs` — `sharp` (SVG→PNG), writes the global app icons.
  - Both `@resvg/resvg-js`, `satori`, and `sharp` are already dependencies.

## Architecture

Four independent units:

### 1. Per-tool manifests (build endpoint)

New Astro endpoint **`src/pages/manifests/[tool].webmanifest.ts`** with
`getStaticPaths()` over the registry, emitting `/manifests/<id>.webmanifest` for
every tool. It imports the registry TS directly (no regex parsing needed —
endpoints run in the Astro/Vite graph) and delegates the object shape to a pure,
tested builder:

```ts
// src/tools/pwa/manifest.lib.ts  (pure, unit-tested)
export interface ToolManifestInput { id: string; name: string; summary: string; category: string; }
export function buildToolManifest(t: ToolManifestInput): Record<string, unknown> {
  return {
    id: `/tools/${t.id}`,
    name: `${t.name} — GoodWebTools`,
    short_name: t.name,
    description: t.summary,
    start_url: `/tools/${t.id}`,
    scope: `/tools/${t.id}`,
    display: 'standalone',
    theme_color: '#0a0a0a',
    background_color: '#fffdf5',
    icons: [
      { src: `/manifests/icons/${t.id}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: `/manifests/icons/${t.id}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
```

Endpoint returns it as `application/manifest+json`.

**Note (locale):** `start_url`/`scope` use the English root (`/tools/<id>`). The
`/id/tools/<id>` Bahasa variant is out of scope for v1 (documented limitation);
the installed app opens the EN page. A later enhancement can emit a second
manifest per locale.

### 2. Per-tool icons (prebuild script)

New **`scripts/make-tool-icons.mjs`** (mirrors `generate-og.mjs`), wired into the
existing prebuild chain in `package.json` next to `generate-og`. For each tool:

- Resolve the tool's lucide glyph SVG. The registry stores the icon as a
  component whose `displayName` is the PascalCase name (verified: `FileText`).
  We map name → kebab-case (`file-text`) and read the raw SVG from
  **`lucide-static`** (new devDependency; ships `icons/<kebab>.svg`).
- Compose the glyph (white stroke) centered on a maskable-safe tile filled with
  the tool's **category color** (reuse the `CAT_COLOR` map already in
  `generate-og.mjs`), matching the brand.
- Rasterize with `sharp` (or resvg) to `public/manifests/icons/<id>-192.png`,
  `-512.png` (maskable safe zone) and `-180.png` (apple-touch, larger glyph).
- Generated at prebuild, **not committed** (like `public/og/`).

Registry parsing reuses `generate-og.mjs`'s regex approach **plus** an
`icon:\s*(\w+)` capture to get the glyph name. A tiny unit test covers the
name→kebab mapping and the CAT_COLOR fallback.

Build cost: ~190 tools × 3 PNGs. OG generation already renders ~190 images at
build, so this is a known, acceptable cost; `make-tool-icons.mjs` accepts a tool
id argv for single-tool local runs (same as `generate-og.mjs`).

### 3. Per-page manifest + apple-touch wiring

- `AstroPWA({ manifest: false, ... })` — the plugin keeps generating the
  **service worker** but stops owning the web manifest, so there is exactly one
  manifest link (ours) and no collision. The global site manifest becomes a
  static **`public/manifest.webmanifest`** (moved out of the plugin config).
- `Base.astro` gains two optional props:
  `manifestHref?: string` (default `/manifest.webmanifest`) and
  `appleTouchIcon?: string` (default `/apple-touch-icon.png`), used in the
  existing `<link rel="manifest">` and `<link rel="apple-touch-icon">`.
- `[...locale]/tools/[tool].astro` passes
  `manifestHref={`/manifests/${id}.webmanifest`}` and
  `appleTouchIcon={`/manifests/icons/${id}-180.png`}`.

**Build assertion:** every `dist/tools/<id>/index.html` links exactly ONE
manifest, pointing at `/manifests/<id>.webmanifest`, and each
`/manifests/<id>.webmanifest` + its icons exist.

### 4. Install UI (React island + hook)

New **`src/hooks/useInstallPrompt.ts`**:

- Early-captures `beforeinstallprompt` (a tiny inline script in `Base.astro`
  head stashes the event on `window.__gwtInstallEvent` and `preventDefault()`s,
  so it isn't missed before the island hydrates; the hook reads/subscribes).
- Exposes `{ canPrompt, isIOS, isStandalone, promptInstall(), installed }`.
- `isStandalone` via `matchMedia('(display-mode: standalone)')` or
  `navigator.standalone` (iOS). Listens for `appinstalled`.

New island **`src/islands/shell/InstallTool.tsx`** (`client:idle`), rendered by
`[tool].astro` in the tool header with `toolId`, `name`, `lang`:

- Renders nothing when `isStandalone` or previously dismissed
  (`localStorage: gwt-install-dismissed:<id>`) or `installed`.
- Android/desktop (`canPrompt`): a **"📲 Install this tool"** button →
  `promptInstall()`.
- iOS (`isIOS`, no `canPrompt`): the button opens a small popover with the
  "Share → Add to Home Screen" steps.
- A subtle dismiss control writes the localStorage flag.
- Bilingual (EN/ID) copy via the established `TR` pattern.

The button lives in the tool page header near the H1/`BETA` badge (in
`[tool].astro`, or `ToolHost` if that's where the header renders — confirmed
during planning).

## Data flow

Build: registry → (endpoint) per-tool manifests + (script) per-tool icons →
`dist`. Page: `[tool].astro` → `Base.astro` links that tool's manifest + apple
icon → browser sees an installable single-tool manifest. Runtime: browser fires
`beforeinstallprompt` (captured) → `InstallTool` shows the button → user installs
→ home-screen icon `start_url:/tools/<id>` launches the tool; the existing SW
serves it offline.

## Testing

- **Unit:** `buildToolManifest` (field shape, id/scope/start_url, icon paths);
  icon name→kebab + CAT_COLOR fallback helper.
- **Build assertions** (script or a lightweight test): all
  `/manifests/<id>.webmanifest` and icon PNGs exist; each tool page links its own
  manifest exactly once.
- **E2E** (`e2e/tools/install-tool.spec.ts`): on a tool page, dispatch a
  synthetic `beforeinstallprompt`; assert the "Install this tool" button appears
  and clicking it calls the event's `prompt()` (spy). Assert it's hidden when
  `matchMedia('(display-mode: standalone)')` is forced true. (Real OS install
  can't be automated.)

## Risks & mitigations

- **Multiple installs per origin:** Chrome/Edge/Android distinguish installed
  apps by manifest `id` — we set a unique `id` per tool. Verify manually on
  Android/desktop Chrome during rollout.
- **`beforeinstallprompt` timing:** captured by an inline head script so it's not
  lost before hydration.
- **iOS:** no programmatic prompt; the button is an instructions affordance. Each
  Add-to-Home-Screen uses the page's `apple-touch-icon` (now per-tool) and the
  existing `apple-mobile-web-app-*` metas → focused launch.
- **`manifest: false` regression:** confirm the SW still builds and the global
  `public/manifest.webmanifest` serves the site install unchanged.
- **Precache size:** per-tool icons are small PNGs; manifests are tiny. Confirm
  no precache-size warning; if needed, `globIgnores` the `manifests/**` glob so
  they're runtime-fetched (still offline via runtime caching).
- **Build time:** ~570 PNGs at prebuild; parallelize/accept as with OG images.

## Rollout

Single PR to `develop` → promote to `main` (standard flow). Because it touches
the PWA/manifest wiring, verify on a real phone (Android Chrome install +
iOS Add-to-Home-Screen) before promoting, and confirm the existing site-wide
install still works. PWA/SW change → users hard-refresh to pick it up.

## Open questions (for plan stage)

- Exact header insertion point for `InstallTool` (`[tool].astro` vs `ToolHost`).
- Whether to precache or runtime-cache the per-tool icons/manifests.
- Confirm `lucide-static` kebab names cover every icon the registry uses (a build
  check can fail loudly on a missing glyph and fall back to the GWT tile).
