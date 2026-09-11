# Per-tool PWA Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every GoodWebTools tool installable as its own focused PWA — tapping the installed icon opens straight into that one tool — with a dismissible "Install this tool" button and a distinct per-tool icon.

**Architecture:** A build-time Astro endpoint emits one web manifest per registry tool (`/manifests/<id>.webmanifest`, `scope`/`start_url` = the tool route, unique `id`). A prebuild script rasterizes a distinct icon per tool from its lucide glyph. `Base.astro` links the per-tool manifest + apple-touch icon on tool pages. A React island shows the install button (native `beforeinstallprompt` on Android/desktop, iOS Add-to-Home-Screen hint). The existing Workbox service worker is untouched and keeps serving offline.

**Tech Stack:** Astro endpoints (`getStaticPaths`), `@vite-pwa/astro` (SW only), `lucide-static` (glyph SVGs), `sharp` (SVG→PNG, already a dep), React island + hook.

**Spec:** `docs/superpowers/specs/2026-09-11-per-tool-pwa-install-design.md`

## Global Constraints

- Client-side only; no server. Nothing uploaded.
- Commit identity `Kresna <13603341+slaveofcode@users.noreply.github.com>`; NO AI-attribution trailers; no `/Users/…` or employer strings in committed files.
- New tools/features default `status: 'beta'` (N/A here — no new registry tool).
- App scope decision: `scope` = `start_url` = `/tools/<id>` (focused single-tool).
- Icons: distinct per tool (192 + 512 maskable, 180 apple-touch), category-colored tile + white glyph.
- Bahasa rule: never render "tool" as "alat"; keep the loanword.
- Verify loop before ship: `npx vitest run` + `npm run test:e2e` + `npm run lint` + `npm run build` all green.

---

### Task 1: Pure manifest + icon-name lib

**Files:**
- Create: `src/tools/pwa/manifest.lib.ts`
- Test: `src/tools/pwa/manifest.lib.test.ts`

**Interfaces:**
- Produces: `buildToolManifest(t: { id: string; name: string; summary: string }): Record<string, unknown>`; `pascalToKebab(name: string): string`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { buildToolManifest, pascalToKebab } from './manifest.lib';

describe('pascalToKebab', () => {
  it.each([['FileText', 'file-text'], ['Clock', 'clock'], ['QrCode', 'qr-code'], ['Wand2', 'wand-2']])(
    '%s → %s', (a, b) => expect(pascalToKebab(a)).toBe(b));
});

describe('buildToolManifest', () => {
  const m = buildToolManifest({ id: 'markdown', name: 'Markdown Preview', summary: 'View Markdown' });
  it('scopes and starts at the tool route with a unique id', () => {
    expect(m.start_url).toBe('/tools/markdown');
    expect(m.scope).toBe('/tools/markdown');
    expect(m.id).toBe('/tools/markdown');
    expect(m.display).toBe('standalone');
  });
  it('names the app and references per-tool icons', () => {
    expect(m.name).toBe('Markdown Preview — GoodWebTools');
    expect(m.short_name).toBe('Markdown Preview');
    const icons = m.icons as Array<{ src: string; sizes: string }>;
    expect(icons.map(i => i.src)).toEqual(['/manifests/icons/markdown-192.png', '/manifests/icons/markdown-512.png']);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/tools/pwa/manifest.lib.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
export function pascalToKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])([0-9])/g, '$1-$2')
    .toLowerCase();
}

export function buildToolManifest(t: { id: string; name: string; summary: string }): Record<string, unknown> {
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

- [ ] **Step 4: Run** — `npx vitest run src/tools/pwa/manifest.lib.test.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(pwa): pure per-tool manifest builder`.

---

### Task 2: Per-tool icon generator (prebuild script)

**Files:**
- Create: `scripts/make-tool-icons.mjs`
- Modify: `package.json` (add `lucide-static` devDep + wire prebuild)

**Interfaces:**
- Produces: `public/manifests/icons/<id>-{192,512,180}.png` for every registry tool.

- [ ] **Step 1: Add dependency** — `npm i -D lucide-static` (ships `node_modules/lucide-static/icons/<kebab>.svg`).

- [ ] **Step 2: Write the script** (mirrors `scripts/generate-og.mjs`; reuses its registry regex + `CAT_COLOR`, adds an `icon:` capture)

```js
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const OUT = 'public/manifests/icons';
mkdirSync(OUT, { recursive: true });
const CAT_COLOR = { Dev:'#3b82f6', PDF:'#ef4444', Image:'#22c55e', Files:'#eab308', Documents:'#14b8a6', Draw:'#a855f7', Media:'#ec4899', Network:'#06b6d4', Maps:'#10b981', Legacy:'#6366f1', Playground:'#f97316', Calculators:'#8b5cf6', Testers:'#0ea5e9' };

function pascalToKebab(n){ return n.replace(/([a-z0-9])([A-Z])/g,'$1-$2').replace(/([A-Za-z])([0-9])/g,'$1-$2').toLowerCase(); }

function readTools(){
  const src = readFileSync('src/registry/tools.ts','utf8');
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?load:\s*\(\)\s*=>\s*import\('[^']+'\)[^}]*\}/g;
  const tools=[]; let m;
  while((m=re.exec(src))){ const e=m[0]; const g=rx=>(e.match(rx)||[])[1]||'';
    tools.push({ id:m[1], category:g(/category:\s*'([^']*)'/), icon:g(/icon:\s*([A-Za-z0-9]+)/) }); }
  return tools;
}

// lucide-static <svg ...><path/>…</svg>. Pull the inner glyph, force white stroke.
function glyphInner(iconName){
  const p = `node_modules/lucide-static/icons/${pascalToKebab(iconName)}.svg`;
  if(!existsSync(p)) return null;
  const svg = readFileSync(p,'utf8');
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  return inner;
}

function tile(size, glyph, color, pad){
  const gs = size - pad*2; // glyph box
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}"/>
  <g transform="translate(${pad},${pad}) scale(${gs/24})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>`;
}

const only = process.argv[2];
const tools = readTools().filter(t=>!only||t.id===only);
let n=0, missing=[];
for(const t of tools){
  const glyph = glyphInner(t.icon);
  const color = CAT_COLOR[t.category] || '#7c3aed';
  if(!glyph){ missing.push(`${t.id}:${t.icon}`); }
  const g = glyph || '<circle cx="12" cy="12" r="8"/>';
  for(const [size,pad] of [[192,44],[512,120],[180,30]]){
    const png = await sharp(Buffer.from(tile(size,g,color,pad))).png().toBuffer();
    writeFileSync(`${OUT}/${t.id}-${size}.png`, png);
  }
  n++;
}
if(missing.length) console.warn(`[make-tool-icons] ${missing.length} tools fell back to a generic glyph:`, missing.join(', '));
console.log(`Generated icons for ${n} tools → ${OUT}/`);
```

- [ ] **Step 3: Wire prebuild** — in `package.json` add `"icons:tools": "node scripts/make-tool-icons.mjs"` and change `prebuild` to `npm run copy:wasm && npm run og && npm run icons:tools`. Add `public/manifests/icons/` to `.gitignore` (generated, like `public/og/`).

- [ ] **Step 4: Run** — `node scripts/make-tool-icons.mjs markdown` → three PNGs written for `markdown`; then full run, confirm no unexpected `missing` glyphs (a few fallbacks are acceptable; log lists them).

- [ ] **Step 5: Commit** — `feat(pwa): generate distinct per-tool app icons at build`.

---

### Task 3: Per-tool manifest endpoint

**Files:**
- Create: `src/pages/manifests/[tool].webmanifest.ts`

**Interfaces:**
- Consumes: `buildToolManifest` (Task 1), the `tools` registry.
- Produces: static `/manifests/<id>.webmanifest` per tool.

- [ ] **Step 1: Implement endpoint**

```ts
import type { APIRoute } from 'astro';
import { tools } from '@/registry/tools';
import { buildToolManifest } from '@/tools/pwa/manifest.lib';

export function getStaticPaths() {
  return tools.map(t => ({ params: { tool: t.id }, props: { name: t.name, summary: t.summary } }));
}

export const GET: APIRoute = ({ params, props }) => {
  const body = JSON.stringify(buildToolManifest({ id: params.tool!, name: props.name, summary: props.summary }));
  return new Response(body, { headers: { 'content-type': 'application/manifest+json; charset=utf-8' } });
};
```

- [ ] **Step 2: Build check** — `npm run build`, then confirm `dist/manifests/markdown.webmanifest` exists and its JSON has `start_url:"/tools/markdown"`. Expected: PASS.
- [ ] **Step 3: Commit** — `feat(pwa): emit a web manifest per tool`.

---

### Task 4: SW-only plugin + global manifest + Base.astro props

**Files:**
- Modify: `astro.config.mjs` (AstroPWA `manifest: false`)
- Verify: `public/manifest.webmanifest` (already exists — becomes authoritative)
- Modify: `src/layouts/Base.astro`

**Interfaces:**
- Produces: `Base.astro` props `manifestHref?: string` (default `/manifest.webmanifest`), `appleTouchIcon?: string` (default `/apple-touch-icon.png`).

- [ ] **Step 1:** In `astro.config.mjs`, set `AstroPWA({ …, manifest: false })` (keep `registerType`, `workbox`, `includeAssets`). Removes the plugin-generated manifest so ours is the only one.

- [ ] **Step 2:** In `src/layouts/Base.astro`: add to `Props` and destructure `manifestHref = '/manifest.webmanifest'` and `appleTouchIcon = '/apple-touch-icon.png'`. Change the head links to `<link rel="manifest" href={manifestHref} />` and the apple-touch icon link to `href={appleTouchIcon}`.

- [ ] **Step 3: Build check** — `npm run build`; confirm (a) SW still emitted (`dist/sw.js` or `dist/registerSW.js` present as before), (b) `dist/manifest.webmanifest` is the static 869B one, (c) a normal page (`dist/index.html`) links exactly one manifest → `/manifest.webmanifest`.
- [ ] **Step 4: Commit** — `feat(pwa): own the web manifest (plugin builds SW only); per-page manifest link`.

---

### Task 5: Wire per-tool manifest + apple icon + install island slot in the tool route

**Files:**
- Modify: `src/pages/[...locale]/tools/[tool].astro`

**Interfaces:**
- Consumes: `Base.astro` props (Task 4); `InstallTool` island (Task 7 — import path `@/islands/shell/InstallTool`).

- [ ] **Step 1:** In `[tool].astro`, pass to `Base`: `manifestHref={`/manifests/${tool.id}.webmanifest`}` and `appleTouchIcon={`/manifests/icons/${tool.id}-180.png`}` (use the resolved tool id variable already in scope).
- [ ] **Step 2:** In the tool header (near the H1/`BETA` badge), render `<InstallTool client:idle toolId={tool.id} name={tool.name} lang={lang} />` (add the import). If `InstallTool` isn't built yet, stub the import with a comment and complete in Task 7 before build.
- [ ] **Step 3: Build check** — `npm run build`; confirm `dist/tools/markdown/index.html` links `/manifests/markdown.webmanifest` (exactly one manifest link) and an apple-touch icon `…markdown-180.png`.
- [ ] **Step 4: Commit** — `feat(pwa): link per-tool manifest + icon on tool pages`.

---

### Task 6: useInstallPrompt hook

**Files:**
- Create: `src/hooks/useInstallPrompt.ts`
- Test: `src/hooks/useInstallPrompt.test.ts`
- Modify: `src/layouts/Base.astro` (early-capture inline script)

**Interfaces:**
- Produces: `useInstallPrompt(): { canPrompt: boolean; isIOS: boolean; isStandalone: boolean; installed: boolean; promptInstall: () => Promise<void> }`.

- [ ] **Step 1: Early-capture script** — in `Base.astro` head (inline, runs before hydration):

```html
<script is:inline>
  window.__gwtInstall = window.__gwtInstall || { evt: null };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__gwtInstall.evt = e; window.dispatchEvent(new Event('gwt-installable')); });
  window.addEventListener('appinstalled', () => { window.__gwtInstall.evt = null; window.dispatchEvent(new Event('gwt-installed')); });
</script>
```

- [ ] **Step 2: Write failing test** (jsdom; simulate the global + events)

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useInstallPrompt } from './useInstallPrompt';

beforeEach(() => { (window as any).__gwtInstall = { evt: null }; });

it('reports canPrompt once a beforeinstallprompt event is captured', () => {
  const { result } = renderHook(() => useInstallPrompt());
  expect(result.current.canPrompt).toBe(false);
  act(() => {
    (window as any).__gwtInstall.evt = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) };
    window.dispatchEvent(new Event('gwt-installable'));
  });
  expect(result.current.canPrompt).toBe(true);
});
```

- [ ] **Step 3: Run to fail** — `npx vitest run src/hooks/useInstallPrompt.test.ts` → FAIL.

- [ ] **Step 4: Implement**

```ts
import { useCallback, useEffect, useState } from 'react';

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setStandalone] = useState(false);
  const [isIOS, setIOS] = useState(false);

  useEffect(() => {
    const w = window as unknown as { __gwtInstall?: { evt: BIPEvent | null } };
    setCanPrompt(!!w.__gwtInstall?.evt);
    const ua = navigator.userAgent || '';
    setIOS(/iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua));
    const mm = window.matchMedia('(display-mode: standalone)');
    const nav = navigator as unknown as { standalone?: boolean };
    setStandalone(mm.matches || nav.standalone === true);
    const onInstallable = () => setCanPrompt(true);
    const onInstalled = () => { setInstalled(true); setCanPrompt(false); };
    const onMM = (e: MediaQueryListEvent) => setStandalone(e.matches);
    window.addEventListener('gwt-installable', onInstallable);
    window.addEventListener('gwt-installed', onInstalled);
    mm.addEventListener?.('change', onMM);
    return () => {
      window.removeEventListener('gwt-installable', onInstallable);
      window.removeEventListener('gwt-installed', onInstalled);
      mm.removeEventListener?.('change', onMM);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const w = window as unknown as { __gwtInstall?: { evt: BIPEvent | null } };
    const evt = w.__gwtInstall?.evt;
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice.catch(() => undefined);
    w.__gwtInstall!.evt = null;
    setCanPrompt(false);
  }, []);

  return { canPrompt, isIOS, isStandalone, installed, promptInstall };
}
```

- [ ] **Step 5: Run** — PASS.
- [ ] **Step 6: Commit** — `feat(pwa): useInstallPrompt hook + early beforeinstallprompt capture`.

---

### Task 7: InstallTool island

**Files:**
- Create: `src/islands/shell/InstallTool.tsx`

**Interfaces:**
- Consumes: `useInstallPrompt` (Task 6). Props `{ toolId: string; name: string; lang?: Lang }`.

- [ ] **Step 1: Implement** (dismiss persisted per-tool; hidden when standalone/installed/dismissed; iOS shows an instructions popover)

```tsx
import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { install: string; ios: string; dismiss: string }> = {
  en: { install: 'Install this tool', ios: 'Tap the Share button, then “Add to Home Screen”.', dismiss: 'Dismiss' },
  id: { install: 'Instal tool ini', ios: 'Tap tombol Share, lalu “Add to Home Screen”.', dismiss: 'Tutup' },
};

export default function InstallTool({ toolId, name, lang = 'en' }: { toolId: string; name: string; lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { canPrompt, isIOS, isStandalone, installed, promptInstall } = useInstallPrompt();
  const key = `gwt-install-dismissed:${toolId}`;
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const [showIOS, setShowIOS] = useState(false);

  if (isStandalone || installed || dismissed || (!canPrompt && !isIOS)) return null;
  const dismiss = () => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } setDismissed(true); };

  return (
    <span className="relative inline-flex items-center gap-1">
      <button type="button" onClick={() => (isIOS ? setShowIOS(v => !v) : promptInstall())}
        className="inline-flex items-center gap-1.5 border-2 border-border bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-accent hover:text-accent-foreground"
        title={`${t.install}: ${name}`}>
        {isIOS ? <Share className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}{t.install}
      </button>
      <button type="button" aria-label={t.dismiss} onClick={dismiss} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      {showIOS && <span className="absolute left-0 top-full z-20 mt-1 w-56 border-2 border-border bg-background p-2 text-xs shadow-brutal">{t.ios}</span>}
    </span>
  );
}
```

- [ ] **Step 2:** Remove the Task-5 stub note; ensure `[tool].astro` imports and renders it.
- [ ] **Step 3: Build check** — `npm run build` succeeds; tool page ships the island.
- [ ] **Step 4: Commit** — `feat(pwa): "Install this tool" button island`.

---

### Task 8: E2E — install button surfaces on a synthetic prompt

**Files:**
- Create: `e2e/tools/install-tool.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

test('shows the install button when a beforeinstallprompt is available', async ({ page }) => {
  await page.goto('/tools/markdown');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => {
    (window as any).__gwtInstall = { evt: { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) } };
    window.dispatchEvent(new Event('gwt-installable'));
  });
  await expect(page.getByRole('button', { name: /Install this tool/i })).toBeVisible({ timeout: 30_000 });
});

test('tool page links its own manifest', async ({ page }) => {
  const res = await page.goto('/tools/markdown');
  expect(res?.status()).toBe(200);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifests/markdown.webmanifest');
});
```

- [ ] **Step 2: Run** — `npm run test:e2e --grep "install"` (kill stale dev server first). Expected: PASS.
- [ ] **Step 3: Commit** — `test(pwa): install button + per-tool manifest E2E`.

---

### Task 9: Verify loop + ship

- [ ] **Step 1:** `npx vitest run` (all green) · `npm run lint` (0 errors) · `npm run build` (green; spot-check `dist/manifests/*.webmanifest` count ≈ tool count; icons present; a normal page links global manifest, a tool page links its own) · `npm run test:e2e --grep "install"`.
- [ ] **Step 2: Hand review** — no leaked streams/listeners in the hook; SSR-safe (all `window`/`navigator` in effects or `is:inline` script); the early-capture script is inert on non-installable browsers; `manifest:false` didn't break the SW.
- [ ] **Step 3: Ship** — branch `feat/per-tool-pwa` (spec already committed there), PR → develop, CI, merge, promote develop→main, confirm Cloudflare prod build, verify a live tool page links its own manifest and (on a real Android/desktop Chrome) the install prompt appears. Tell the user to hard-refresh (SW).

---

## Self-Review

- **Spec coverage:** manifests (T1,T3), icons (T2), plugin/manifest wiring (T4), per-page link + island slot (T5), hook (T6), button/iOS/dismiss (T7), tests (T1,T6,T8), risks (early-capture in T6, `manifest:false` verified in T4, iOS in T7). Locale limitation (EN start_url) accepted in spec.
- **Placeholder scan:** none — all code inline.
- **Type consistency:** `buildToolManifest`/`pascalToKebab` names match across T1/T2/T3; `useInstallPrompt` return shape matches T6↔T7; island props `{toolId,name,lang}` match T5↔T7.
