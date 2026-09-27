# Tool Error Reporting (MVP / Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an opt-in, consent-gated "Report a problem" flow on every tool page that sends rich diagnostics + logs (and optionally the failing file) to a private R2 bucket via a Cloudflare Worker endpoint, so we can fix failures we can't reproduce.

**Architecture:** Client-side services (breadcrumbs ring buffer, diagnostics collector, file magic-byte sniffer, a small reporter bus) feed a `ReportDialog` island rendered by `ToolHost` on every page. Tools "wire in" with a one-line `useReportable` hook so the dialog can grab the exact failing `File` and caught error. Submission is a multipart POST to a new `worker/index.js` route `/api/report`, gated by Cloudflare Turnstile + a 10 MB size cap, stored in a new private R2 bucket `goodwebtools-reports`.

**Tech Stack:** Astro (static) + React islands, TypeScript, Vitest (jsdom), Playwright, Cloudflare Workers + R2, Cloudflare Turnstile.

**Spec:** `docs/superpowers/specs/2026-09-26-tool-error-reporting-design.md`

## Global Constraints

- **Privacy-first:** nothing is sent without an explicit Submit click **and** a ticked consent checkbox. The file is a **separate, pre-unchecked** attachment with a sensitivity warning.
- **SSR safety:** no `window`/`navigator`/`document`/`screen` at module scope; guard every access with `typeof window !== 'undefined'` and only touch them inside functions/effects.
- **Thin island, pure libs:** all logic in `src/services/report/*` (framework-free, Vitest-tested); islands are covered by Playwright only.
- **i18n:** every user-facing string in EN + ID via a `TR: Record<Lang, …>` map. **Never** translate "tool" as "alat" — keep the loanword "tool".
- **Identity (public repo):** commit as `Kresna <13603341+slaveofcode@users.noreply.github.com>`; **no** AI-attribution trailers/session links; no `/Users/…` paths or `usetada`/`tada-` strings in any committed file. Run the staged-diff sweep before every commit.
- **Secrets:** `TURNSTILE_SECRET` (+ later `ADMIN_REPORT_TOKEN`, `REPORT_WEBHOOK_URL`) are Cloudflare secrets, never committed. Only the **public** Turnstile site key ships in the repo. Default site key = Cloudflare test key `1x00000000000000000000AA` (always passes) until a real one is set.
- **Size cap:** attached file ≤ **10 MB**; reject larger server-side (413) and guard client-side.
- **MVP scope note:** per-IP Durable-Object rate limiting, the admin viewer, webhook ping, R2 retention lifecycle, and the Privacy-page copy are **Sub-project B** — not in this plan. Turnstile + the size cap are the MVP's abuse defenses.

## Review Focus

- **Storage-blocked / private-mode browsers:** `collectDiagnostics` must never throw when `localStorage`/`indexedDB` access throws — pinned in Task 3.
- **No `File` in context** (unwired tool, or user opens the report with no file loaded): diagnostics omit the `file` block and submit works file-less — pinned in Tasks 3 & 5.
- **Oversized file (>10 MB):** server returns 413 and the client shows a friendly message instead of the thank-you — pinned in Tasks 5 & 10.
- **Missing/failed Turnstile token:** server returns 403 (pinned in Task 7); the client surfaces an error and stays off the thank-you state (pinned in Task 10's failure case).
- **Non-serializable / circular breadcrumb data or error cause:** the payload must serialize without throwing (safe stringify) — pinned in Task 2.

---

### Task 1: Shared types + file magic-byte sniffer

**Files:**
- Create: `src/services/report/types.ts`
- Create: `src/services/report/fileMeta.ts`
- Test: `src/services/report/fileMeta.test.ts`

**Interfaces:**
- Produces: `Breadcrumb`, `FileMeta`, `Diagnostics`, `ReportContext`, `ReportPrefill` (types); `sniffMagic(bytes: Uint8Array): string`; `sniffFileMeta(file: File): Promise<FileMeta>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/report/fileMeta.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sniffMagic, sniffFileMeta } from './fileMeta';

const u8 = (...b: number[]) => new Uint8Array(b);

describe('sniffMagic', () => {
  it.each([
    ['jpeg', u8(0xff, 0xd8, 0xff, 0xe0)],
    ['png', u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ['gif', u8(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)],
    ['pdf', u8(0x25, 0x50, 0x44, 0x46, 0x2d)],
  ])('detects %s', (fmt, bytes) => {
    expect(sniffMagic(bytes)).toBe(fmt);
  });

  it('detects webp (RIFF....WEBP)', () => {
    expect(sniffMagic(u8(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe('webp');
  });

  it('detects heic (ftyp heic)', () => {
    const bytes = u8(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
    expect(sniffMagic(bytes)).toBe('heic');
  });

  it('returns "unknown" for unrecognized bytes', () => {
    expect(sniffMagic(u8(1, 2, 3, 4))).toBe('unknown');
  });
});

describe('sniffFileMeta', () => {
  it('reports claimed vs actual format and marks a non-decodable image', async () => {
    // A file that claims JPEG but whose bytes are actually HEIC — the classic case.
    const heic = u8(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
    const file = new File([heic], 'photo.jpeg', { type: 'image/jpeg', lastModified: 123 });
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('cannot decode')));
    const meta = await sniffFileMeta(file);
    expect(meta.claimedType).toBe('image/jpeg');
    expect(meta.actualFormat).toBe('heic');
    expect(meta.size).toBe(heic.byteLength);
    expect(meta.decodeOk).toBe(false);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/report/fileMeta.test.ts`
Expected: FAIL — module `./fileMeta` not found.

- [ ] **Step 3: Write the types**

```ts
// src/services/report/types.ts
export interface Breadcrumb {
  t: number;
  kind: 'action' | 'console' | 'error';
  action: string;
  data?: Record<string, unknown>;
}

export interface FileMeta {
  claimedType: string;
  actualFormat: string;
  size: number;
  lastModified: number;
  decodeOk?: boolean;
  width?: number;
  height?: number;
}

export interface Diagnostics {
  app: { reportId: string; timestamp: string; build: string; toolId: string; route: string; locale: string };
  browser: Record<string, unknown>;
  display: Record<string, unknown>;
  capabilities: Record<string, boolean | string | number>;
  error?: { name: string; message: string; stack?: string; causeChain?: string[] };
  file?: FileMeta;
  logs: { breadcrumbs: Breadcrumb[] };
  user?: { message?: string };
}

export interface ReportContext {
  toolId: string;
  getFile?: () => File | null;
  extra?: Record<string, unknown>;
}

export interface ReportPrefill { error?: Error | null }
```

- [ ] **Step 4: Write the sniffer**

```ts
// src/services/report/fileMeta.ts
import type { FileMeta } from './types';

/** Detect a file's real container from its leading bytes (magic numbers). */
export function sniffMagic(b: Uint8Array): string {
  const a = (i: number) => b[i];
  if (a(0) === 0xff && a(1) === 0xd8 && a(2) === 0xff) return 'jpeg';
  if (a(0) === 0x89 && a(1) === 0x50 && a(2) === 0x4e && a(3) === 0x47) return 'png';
  if (a(0) === 0x47 && a(1) === 0x49 && a(2) === 0x46) return 'gif';
  if (a(0) === 0x25 && a(1) === 0x50 && a(2) === 0x44 && a(3) === 0x46) return 'pdf';
  if (a(0) === 0x52 && a(1) === 0x49 && a(2) === 0x46 && a(3) === 0x46 &&
      a(8) === 0x57 && a(9) === 0x45 && a(10) === 0x42 && a(11) === 0x50) return 'webp';
  // ISO-BMFF: bytes 4..7 = 'ftyp', 8..11 = brand
  if (a(4) === 0x66 && a(5) === 0x74 && a(6) === 0x79 && a(7) === 0x70) {
    const brand = String.fromCharCode(a(8), a(9), a(10), a(11));
    if (brand.startsWith('hei') || brand.startsWith('mif')) return 'heic';
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'avif';
    return 'mp4';
  }
  return 'unknown';
}

/** Collect claimed-vs-actual format + (for images) decode success + dimensions. */
export async function sniffFileMeta(file: File): Promise<FileMeta> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const meta: FileMeta = {
    claimedType: file.type || 'unknown',
    actualFormat: sniffMagic(head),
    size: file.size,
    lastModified: file.lastModified,
  };
  if ((file.type || '').startsWith('image/') && typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      meta.decodeOk = true;
      meta.width = bmp.width;
      meta.height = bmp.height;
      bmp.close?.();
    } catch {
      meta.decodeOk = false;
    }
  }
  return meta;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/report/fileMeta.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/report/types.ts src/services/report/fileMeta.ts src/services/report/fileMeta.test.ts
git commit -m "feat(report): shared types + file magic-byte sniffer"
```

---

### Task 2: Breadcrumbs ring buffer + safe serialize + global capture

**Files:**
- Create: `src/services/report/breadcrumbs.ts`
- Test: `src/services/report/breadcrumbs.test.ts`

**Interfaces:**
- Consumes: `Breadcrumb` from `./types`.
- Produces: `pushBreadcrumb(kind, action, data?)`; `breadcrumb(action, data?)` (kind `'action'`); `getBreadcrumbs(): Breadcrumb[]`; `clearBreadcrumbs()`; `safeClone(v: unknown): unknown`; `installGlobalCapture(): void` (idempotent).

- [ ] **Step 1: Write the failing test**

```ts
// src/services/report/breadcrumbs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { pushBreadcrumb, breadcrumb, getBreadcrumbs, clearBreadcrumbs, safeClone } from './breadcrumbs';

beforeEach(() => clearBreadcrumbs());

describe('breadcrumbs ring buffer', () => {
  it('records actions in order', () => {
    breadcrumb('file-selected', { size: 10 });
    breadcrumb('compress-start');
    const b = getBreadcrumbs();
    expect(b.map(x => x.action)).toEqual(['file-selected', 'compress-start']);
    expect(b[0].kind).toBe('action');
  });

  it('caps at 200 entries, evicting the oldest', () => {
    for (let i = 0; i < 250; i++) pushBreadcrumb('action', `a${i}`);
    const b = getBreadcrumbs();
    expect(b).toHaveLength(200);
    expect(b[0].action).toBe('a50');
    expect(b[199].action).toBe('a249');
  });
});

describe('safeClone', () => {
  it('drops circular references without throwing', () => {
    const o: Record<string, unknown> = { a: 1 };
    o.self = o;
    const cloned = safeClone(o) as Record<string, unknown>;
    expect(cloned.a).toBe(1);
    expect(JSON.stringify(cloned)).toContain('a'); // serializes cleanly
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/report/breadcrumbs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/services/report/breadcrumbs.ts
import type { Breadcrumb } from './types';

const CAP = 200;
let buffer: Breadcrumb[] = [];
let installed = false;

/** Structured-clone-ish serialization that strips circular refs and functions. */
export function safeClone(value: unknown): unknown {
  const seen = new WeakSet();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
    if (seen.has(v as object)) return '[circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
    return out;
  };
  return walk(value);
}

export function pushBreadcrumb(kind: Breadcrumb['kind'], action: string, data?: Record<string, unknown>): void {
  buffer.push({ t: Date.now(), kind, action, data: data ? (safeClone(data) as Record<string, unknown>) : undefined });
  if (buffer.length > CAP) buffer = buffer.slice(buffer.length - CAP);
}

export const breadcrumb = (action: string, data?: Record<string, unknown>) => pushBreadcrumb('action', action, data);
export const getBreadcrumbs = (): Breadcrumb[] => buffer.slice();
export const clearBreadcrumbs = (): void => { buffer = []; };

/** Patch console.warn/error and window error handlers to leave breadcrumbs. Idempotent. */
export function installGlobalCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const cap = (s: unknown) => String(s).slice(0, 500);
  for (const level of ['warn', 'error'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      pushBreadcrumb('console', level, { msg: args.map(cap).join(' ') });
      orig(...args);
    };
  }
  window.addEventListener('error', e => pushBreadcrumb('error', 'window.error', { msg: cap(e.message) }));
  window.addEventListener('unhandledrejection', e =>
    pushBreadcrumb('error', 'unhandledrejection', { msg: cap((e as PromiseRejectionEvent).reason) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/report/breadcrumbs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/report/breadcrumbs.ts src/services/report/breadcrumbs.test.ts
git commit -m "feat(report): breadcrumb ring buffer + safe serialize + global capture"
```

---

### Task 3: Diagnostics collector + build SHA config

**Files:**
- Create: `src/services/report/diagnostics.ts`
- Test: `src/services/report/diagnostics.test.ts`
- Modify: `src/config.ts` (add `BUILD_SHA`)
- Modify: `astro.config.mjs` (inject `PUBLIC_BUILD_SHA` at build)

**Interfaces:**
- Consumes: `Diagnostics`, `FileMeta` from `./types`; `getBreadcrumbs` from `./breadcrumbs`; `BUILD_SHA` from `@/config`.
- Produces: `collectDiagnostics(input: { toolId: string; route: string; error?: Error | null; file?: FileMeta; userMessage?: string }): Diagnostics`.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/report/diagnostics.test.ts
import { describe, it, expect } from 'vitest';
import { collectDiagnostics } from './diagnostics';

describe('collectDiagnostics', () => {
  it('always fills the app block and capability keys', () => {
    const d = collectDiagnostics({ toolId: 'image-compress', route: '/tools/image-compress' });
    expect(d.app.toolId).toBe('image-compress');
    expect(d.app.route).toBe('/tools/image-compress');
    expect(typeof d.app.reportId).toBe('string');
    expect(d.app.reportId.length).toBeGreaterThan(0);
    expect('wasm' in d.capabilities).toBe(true);
    expect('createImageBitmap' in d.capabilities).toBe(true);
    expect(Array.isArray(d.logs.breadcrumbs)).toBe(true);
  });

  it('maps a caught error including its cause chain', () => {
    const err = new Error('boom', { cause: new Error('root cause') });
    const d = collectDiagnostics({ toolId: 't', route: '/r', error: err });
    expect(d.error?.message).toBe('boom');
    expect(d.error?.causeChain?.[0]).toContain('root cause');
  });

  it('omits the file block when no file meta is provided', () => {
    const d = collectDiagnostics({ toolId: 't', route: '/r' });
    expect(d.file).toBeUndefined();
  });

  it('does not throw when storage access is blocked (private mode)', () => {
    const desc = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    expect(() => collectDiagnostics({ toolId: 't', route: '/r' })).not.toThrow();
    if (desc) Object.defineProperty(window, 'localStorage', desc);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/report/diagnostics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the build-SHA config constant**

In `src/config.ts`, add:

```ts
/** Short git SHA of the deployed build, injected at build time (see astro.config.mjs).
 * Falls back to 'dev' for local/dev where it isn't set. Public, non-secret. */
export const BUILD_SHA = import.meta.env.PUBLIC_BUILD_SHA || 'dev';
```

- [ ] **Step 4: Inject `PUBLIC_BUILD_SHA` at build**

In `astro.config.mjs`, near the top (after imports), compute the SHA and expose it to Vite. Use Cloudflare's commit env when present, else `git rev-parse`, guarded so a missing git never breaks the build:

```js
import { execSync } from 'node:child_process';

const BUILD_SHA = (() => {
  if (process.env.PUBLIC_BUILD_SHA) return process.env.PUBLIC_BUILD_SHA;
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; }
})();
process.env.PUBLIC_BUILD_SHA = BUILD_SHA;
```

(Astro/Vite exposes `process.env.PUBLIC_*` to `import.meta.env`, so no `define` block is needed.)

- [ ] **Step 5: Write the collector**

```ts
// src/services/report/diagnostics.ts
import type { Diagnostics, FileMeta } from './types';
import { getBreadcrumbs } from './breadcrumbs';
import { BUILD_SHA } from '@/config';

const probe = <T>(fn: () => T): T | undefined => { try { return fn(); } catch { return undefined; } };
const has = (fn: () => boolean): boolean => { try { return fn(); } catch { return false; } };

function capabilities(): Record<string, boolean | string | number> {
  const w = window as unknown as Record<string, unknown>;
  const nav = navigator as unknown as Record<string, unknown>;
  return {
    wasm: has(() => typeof WebAssembly === 'object'),
    wasmSimd: has(() => 'Memory' in WebAssembly),
    crossOriginIsolated: has(() => !!(w.crossOriginIsolated)),
    sharedArrayBuffer: has(() => typeof SharedArrayBuffer !== 'undefined'),
    offscreenCanvas: has(() => typeof OffscreenCanvas !== 'undefined'),
    webgl: has(() => !!document.createElement('canvas').getContext('webgl')),
    webgl2: has(() => !!document.createElement('canvas').getContext('webgl2')),
    webgpu: has(() => 'gpu' in navigator),
    webCodecs: has(() => typeof (w.VideoEncoder) !== 'undefined'),
    createImageBitmap: has(() => typeof createImageBitmap === 'function'),
    localStorage: has(() => { void window.localStorage; return true; }),
    indexedDB: has(() => typeof indexedDB !== 'undefined'),
    effectiveType: (probe(() => (nav.connection as { effectiveType?: string } | undefined)?.effectiveType) as string) || 'unknown',
    online: has(() => navigator.onLine),
  };
}

function causeChain(err: Error): string[] {
  const out: string[] = [];
  let cause: unknown = (err as { cause?: unknown }).cause;
  let guard = 0;
  while (cause && guard++ < 5) {
    out.push(cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause));
    cause = (cause as { cause?: unknown }).cause;
  }
  return out;
}

export function collectDiagnostics(input: {
  toolId: string; route: string; error?: Error | null; file?: FileMeta; userMessage?: string;
}): Diagnostics {
  const uaData = probe(() => (navigator as unknown as { userAgentData?: Record<string, unknown> }).userAgentData);
  const d: Diagnostics = {
    app: {
      reportId: probe(() => crypto.randomUUID()) || String(Date.now()) + Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      build: BUILD_SHA,
      toolId: input.toolId,
      route: input.route,
      locale: probe(() => navigator.language) || 'unknown',
    },
    browser: {
      userAgent: probe(() => navigator.userAgent) || 'unknown',
      platform: uaData?.platform,
      mobile: uaData?.mobile,
      deviceMemory: probe(() => (navigator as unknown as { deviceMemory?: number }).deviceMemory),
      hardwareConcurrency: probe(() => navigator.hardwareConcurrency),
      languages: probe(() => [...navigator.languages]),
      timezone: probe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    },
    display: {
      screenW: probe(() => screen.width),
      screenH: probe(() => screen.height),
      dpr: probe(() => window.devicePixelRatio),
      viewportW: probe(() => window.innerWidth),
      viewportH: probe(() => window.innerHeight),
      colorScheme: has(() => window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
      reducedMotion: has(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    },
    capabilities: capabilities(),
    logs: { breadcrumbs: getBreadcrumbs() },
  };
  if (input.error) {
    d.error = {
      name: input.error.name,
      message: input.error.message,
      stack: input.error.stack?.slice(0, 4000),
      causeChain: causeChain(input.error),
    };
  }
  if (input.file) d.file = input.file;
  if (input.userMessage) d.user = { message: input.userMessage.slice(0, 2000) };
  return d;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/services/report/diagnostics.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/report/diagnostics.ts src/services/report/diagnostics.test.ts src/config.ts astro.config.mjs
git commit -m "feat(report): diagnostics collector + build SHA injection"
```

---

### Task 4: Reporter bus

**Files:**
- Create: `src/services/report/reporter.ts`
- Test: `src/services/report/reporter.test.ts`

**Interfaces:**
- Consumes: `ReportContext`, `ReportPrefill` from `./types`.
- Produces: `setContext(ctx)`, `clearContext(toolId)`, `getCurrentFile(): File | null`, `getContext(): ReportContext | null`, `setLastError(e)`, `takeLastError(): Error | null`, `onOpen(fn): () => void`, `openReportDialog(prefill?)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/report/reporter.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setContext, clearContext, getCurrentFile, setLastError, takeLastError, onOpen, openReportDialog } from './reporter';

beforeEach(() => { clearContext('image-compress'); clearContext('other'); takeLastError(); });

describe('reporter bus', () => {
  it('exposes the current tool file via the registered getter', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    setContext({ toolId: 'image-compress', getFile: () => file });
    expect(getCurrentFile()).toBe(file);
  });

  it('clearContext only clears a matching toolId', () => {
    setContext({ toolId: 'image-compress', getFile: () => null });
    clearContext('other');
    expect(getCurrentFile()).toBeNull(); // still the image-compress ctx, whose file is null
    clearContext('image-compress');
    expect(getCurrentFile()).toBeNull();
  });

  it('notifies open listeners with the prefill and stashes lastError', () => {
    const seen: unknown[] = [];
    const off = onOpen(p => seen.push(p));
    const err = new Error('boom');
    setLastError(err);
    openReportDialog({ error: err });
    expect(seen).toEqual([{ error: err }]);
    expect(takeLastError()).toBe(err);
    off();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/report/reporter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/services/report/reporter.ts
import type { ReportContext, ReportPrefill } from './types';

let context: ReportContext | null = null;
let lastError: Error | null = null;
const openListeners = new Set<(p: ReportPrefill) => void>();

export const setContext = (ctx: ReportContext): void => { context = ctx; };
export const clearContext = (toolId: string): void => { if (context?.toolId === toolId) context = null; };
export const getContext = (): ReportContext | null => context;
export const getCurrentFile = (): File | null => { try { return context?.getFile?.() ?? null; } catch { return null; } };

export const setLastError = (e: Error): void => { lastError = e; };
export const takeLastError = (): Error | null => { const e = lastError; lastError = null; return e; };

export function onOpen(fn: (p: ReportPrefill) => void): () => void {
  openListeners.add(fn);
  return () => openListeners.delete(fn);
}
export function openReportDialog(prefill: ReportPrefill = {}): void {
  openListeners.forEach(fn => fn(prefill));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/report/reporter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/report/reporter.ts src/services/report/reporter.test.ts
git commit -m "feat(report): reporter bus (context, lastError, open events)"
```

---

### Task 5: Submit form builder + client submit

**Files:**
- Create: `src/services/report/submit.ts`
- Test: `src/services/report/submit.test.ts`

**Interfaces:**
- Consumes: `Diagnostics` from `./types`.
- Produces: `MAX_FILE_BYTES` (number, 10 MB); `buildReportForm(d: Diagnostics, file: File | null, token: string): FormData`; `submitReport(d, file, token): Promise<{ id: string }>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/report/submit.test.ts
import { describe, it, expect } from 'vitest';
import { buildReportForm, MAX_FILE_BYTES } from './submit';
import type { Diagnostics } from './types';

const diag: Diagnostics = {
  app: { reportId: 'r1', timestamp: 't', build: 'dev', toolId: 'image-compress', route: '/r', locale: 'en' },
  browser: {}, display: {}, capabilities: {}, logs: { breadcrumbs: [] },
};

describe('buildReportForm', () => {
  it('always includes report.json and the turnstile token', () => {
    const fd = buildReportForm(diag, null, 'tok');
    expect(fd.get('token')).toBe('tok');
    expect(fd.get('report') instanceof Blob).toBe(true);
    expect(fd.get('file')).toBeNull();
  });

  it('includes the file when attached', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const fd = buildReportForm(diag, file, 'tok');
    expect((fd.get('file') as File).name).toBe('a.png');
  });

  it('caps the file at 10 MB', () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/report/submit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/services/report/submit.ts
import type { Diagnostics } from './types';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function buildReportForm(d: Diagnostics, file: File | null, token: string): FormData {
  const fd = new FormData();
  fd.set('report', new Blob([JSON.stringify(d)], { type: 'application/json' }), 'report.json');
  fd.set('token', token);
  if (file) fd.set('file', file, file.name);
  return fd;
}

export async function submitReport(d: Diagnostics, file: File | null, token: string): Promise<{ id: string }> {
  // Dev-only E2E stub: Playwright sets window.__E2E_REPORT__ to bypass the network + Turnstile.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const stub = (window as unknown as { __E2E_REPORT__?: { id?: string; fail?: boolean } }).__E2E_REPORT__;
    if (stub) {
      if (stub.fail) throw new Error('stub failure');
      return { id: stub.id || 'e2e-report-id' };
    }
  }
  if (file && file.size > MAX_FILE_BYTES) throw new Error('File is larger than 10 MB.');
  const res = await fetch('/api/report', { method: 'POST', body: buildReportForm(d, file, token) });
  if (!res.ok) throw new Error(`Report failed (${res.status}).`);
  return res.json() as Promise<{ id: string }>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/report/submit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/report/submit.ts src/services/report/submit.test.ts
git commit -m "feat(report): report form builder + client submit (with dev E2E stub)"
```

---

### Task 6: `useReportable` hook

**Files:**
- Create: `src/hooks/useReportable.ts`
- Test: `src/hooks/useReportable.test.ts`

**Interfaces:**
- Consumes: `setContext`, `clearContext`, `getCurrentFile` from `@/services/report/reporter`.
- Produces: `useReportable(opts: { toolId: string; file?: File | null; extra?: Record<string, unknown> }): void`.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useReportable.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReportable } from './useReportable';
import { getCurrentFile } from '@/services/report/reporter';

describe('useReportable', () => {
  it('registers the current file and updates on change', () => {
    const a = new File(['a'], 'a.png', { type: 'image/png' });
    const b = new File(['b'], 'b.png', { type: 'image/png' });
    const { rerender, unmount } = renderHook(({ f }) => useReportable({ toolId: 'image-compress', file: f }), {
      initialProps: { f: a as File | null },
    });
    expect(getCurrentFile()).toBe(a);
    rerender({ f: b });
    expect(getCurrentFile()).toBe(b);
    unmount();
    expect(getCurrentFile()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useReportable.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useReportable.ts
import { useEffect, useRef } from 'react';
import { setContext, clearContext } from '@/services/report/reporter';

/** Register a tool's current input file + context with the reporter bus, so the
 * global Report dialog can attach the exact failing file. Clears on unmount. */
export function useReportable(opts: { toolId: string; file?: File | null; extra?: Record<string, unknown> }): void {
  const fileRef = useRef<File | null>(opts.file ?? null);
  fileRef.current = opts.file ?? null;

  useEffect(() => {
    setContext({ toolId: opts.toolId, getFile: () => fileRef.current, extra: opts.extra });
    return () => clearContext(opts.toolId);
    // Re-register only if the toolId changes; the file is read live via the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.toolId]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useReportable.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useReportable.ts src/hooks/useReportable.test.ts
git commit -m "feat(report): useReportable hook"
```

---

### Task 7: Worker `/api/report` endpoint + R2 binding + worker tests

**Files:**
- Create: `worker/report.js`
- Create: `worker/report.test.js`
- Modify: `worker/index.js` (dispatch `/api/report`)
- Modify: `wrangler.jsonc` (add `REPORTS` R2 binding, prod + staging)
- Modify: `vitest.config.ts` (include `worker/**/*.test.js`)

**Interfaces:**
- Produces: `handleReport(request, env): Promise<Response>`. `env` provides `REPORTS` (R2 bucket) and `TURNSTILE_SECRET` (string, optional in tests).

- [ ] **Step 1: Add worker tests to the Vitest include**

In `vitest.config.ts`, change the `include` line to also match worker tests:

```ts
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'worker/**/*.test.js'],
```

- [ ] **Step 2: Write the failing test**

```js
// worker/report.test.js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleReport } from './report.js';

function makeEnv() {
  const puts = [];
  return {
    puts,
    env: {
      TURNSTILE_SECRET: 'secret',
      REPORTS: { put: vi.fn(async (key, body) => { puts.push({ key, body }); }) },
    },
  };
}

function makeRequest({ token = 'tok', file = null, method = 'POST' } = {}) {
  const fd = new FormData();
  fd.set('report', new Blob([JSON.stringify({ app: { reportId: 'r1' } })], { type: 'application/json' }), 'report.json');
  if (token !== null) fd.set('token', token);
  if (file) fd.set('file', file, 'f.bin');
  return new Request('https://x/api/report', { method, body: method === 'POST' ? fd : undefined });
}

beforeEach(() => { vi.restoreAllMocks(); });

describe('handleReport', () => {
  it('stores the report and returns an id when Turnstile passes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))));
    const { env, puts } = makeEnv();
    const res = await handleReport(makeRequest(), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.id).toBe('string');
    expect(puts.some(p => p.key.endsWith('/report.json'))).toBe(true);
  });

  it('rejects a non-POST with 405', async () => {
    const { env } = makeEnv();
    const res = await handleReport(makeRequest({ method: 'GET' }), env);
    expect(res.status).toBe(405);
  });

  it('rejects a missing/failed Turnstile token with 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }))));
    const { env } = makeEnv();
    const res = await handleReport(makeRequest({ token: 'bad' }), env);
    expect(res.status).toBe(403);
  });

  it('rejects an oversized file with 413', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))));
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.bin');
    const { env } = makeEnv();
    const res = await handleReport(makeRequest({ file: big }), env);
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run worker/report.test.js`
Expected: FAIL — module `./report.js` not found.

- [ ] **Step 4: Write the handler**

```js
// worker/report.js
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function verifyTurnstile(token, secret, ip) {
  if (!secret) return true; // unconfigured (e.g. self-host without Turnstile) → accept
  if (!token) return false;
  try {
    const body = new FormData();
    body.set('secret', secret);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

/** POST /api/report — verify Turnstile, cap size, store report (+ optional file) in R2. */
export async function handleReport(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let form;
  try { form = await request.formData(); } catch { return json({ error: 'Bad form data' }, 400); }

  const ip = request.headers.get('cf-connecting-ip') || '';
  const ok = await verifyTurnstile(form.get('token'), env.TURNSTILE_SECRET, ip);
  if (!ok) return json({ error: 'Verification failed' }, 403);

  const reportBlob = form.get('report');
  if (!reportBlob) return json({ error: 'Missing report' }, 400);
  const reportText = await reportBlob.text();
  if (reportText.length > 512 * 1024) return json({ error: 'Report too large' }, 413);

  const file = form.get('file');
  if (file && file.size > MAX_FILE_BYTES) return json({ error: 'File too large' }, 413);

  let parsed = {};
  try { parsed = JSON.parse(reportText); } catch { /* store raw anyway */ }
  const id = (parsed.app && parsed.app.reportId) || crypto.randomUUID();
  const now = new Date();
  const prefix = `reports/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}`;

  await env.REPORTS.put(`${prefix}/report.json`, reportText, { httpMetadata: { contentType: 'application/json' } });
  if (file) {
    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'bin';
    await env.REPORTS.put(`${prefix}/file.${ext}`, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });
  }

  // Optional webhook ping (Sub-project B enriches this); never send file bytes/PII.
  if (env.REPORT_WEBHOOK_URL) {
    try {
      await fetch(env.REPORT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, toolId: parsed.app?.toolId, error: parsed.error?.message }),
      });
    } catch { /* best-effort */ }
  }

  return json({ id });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run worker/report.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Dispatch the route in the Worker**

In `worker/index.js`, add the import at the top (next to the `SignalRoom` export):

```js
import { handleReport } from './report.js';
```

And add this dispatch block **before** the `/api/turn` block:

```js
    if (url.pathname === '/api/report') {
      return handleReport(request, env);
    }
```

- [ ] **Step 7: Add the R2 binding to `wrangler.jsonc`**

In the top-level `"r2_buckets"` array, add the reports bucket:

```jsonc
  "r2_buckets": [
    { "binding": "MODELS", "bucket_name": "goodwebtools-models" },
    { "binding": "REPORTS", "bucket_name": "goodwebtools-reports" }
  ],
```

And in `env.staging.r2_buckets`, add the staging bucket:

```jsonc
      "r2_buckets": [
        { "binding": "MODELS", "bucket_name": "goodwebtools-models-staging" },
        { "binding": "REPORTS", "bucket_name": "goodwebtools-reports-staging" }
      ],
```

> **Deploy note (do at ship time, not in code):** the buckets must exist —
> `npx wrangler r2 bucket create goodwebtools-reports` and `…-staging` — and set
> the secret: `npx wrangler secret put TURNSTILE_SECRET` (and `--env staging`).
> Until a real Turnstile secret is set, the endpoint accepts submissions (self-host
> friendly); set the secret before announcing the feature.

- [ ] **Step 8: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS, including `worker/report.test.js`.

- [ ] **Step 9: Commit**

```bash
git add worker/report.js worker/report.test.js worker/index.js wrangler.jsonc vitest.config.ts
git commit -m "feat(report): /api/report worker endpoint + R2 binding"
```

---

### Task 8: ReportDialog island (UI, Turnstile, consent, thank-you)

**Files:**
- Create: `src/islands/report/ReportDialog.tsx`
- Modify: `src/config.ts` (add `TURNSTILE_SITE_KEY`)

**Interfaces:**
- Consumes: `onOpen`, `getCurrentFile`, `getContext`, `takeLastError` from `@/services/report/reporter`; `collectDiagnostics`; `sniffFileMeta`; `submitReport`; `breadcrumb`; `TURNSTILE_SITE_KEY` from `@/config`; `Button`, `Alert`.
- Produces: default export `ReportDialog({ lang }: { lang?: Lang })`.

- [ ] **Step 1: Add the Turnstile site key to config**

In `src/config.ts`:

```ts
/** Cloudflare Turnstile PUBLIC site key (not a secret). Defaults to Cloudflare's
 * always-pass test key so self-host/staging work before a real key is set. */
export const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';
```

- [ ] **Step 2: Write the dialog**

```tsx
// src/islands/report/ReportDialog.tsx
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { TURNSTILE_SITE_KEY } from '@/config';
import { onOpen, getCurrentFile, getContext, takeLastError } from '@/services/report/reporter';
import { collectDiagnostics } from '@/services/report/diagnostics';
import { sniffFileMeta } from '@/services/report/fileMeta';
import { submitReport } from '@/services/report/submit';
import { breadcrumb } from '@/services/report/breadcrumbs';
import type { Diagnostics } from '@/services/report/types';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Report a problem', desc: 'Send us diagnostics so we can fix this. Runs only when you submit.',
    what: 'What were you doing when it failed? (optional)',
    seeData: 'See exactly what will be sent', consent: 'I agree to send the diagnostics and logs above to help fix this error.',
    attach: 'Also attach my file', attachWarn: 'Your file may contain personal or financial data. Only attach it if you are OK sending it to us.',
    noFile: 'No file is loaded for this tool.', send: 'Send report', sending: 'Sending…', cancel: 'Close',
    thanksTitle: 'Thank you!', thanksBody: 'Your report helps us fix this for everyone hitting the same error. 🙌',
    ref: 'Reference', failed: 'Sorry — the report could not be sent. Please try again.',
    needConsent: 'Please tick the consent box to send.',
  },
  id: {
    title: 'Laporkan masalah', desc: 'Kirim diagnostik agar kami bisa memperbaikinya. Hanya berjalan saat Anda kirim.',
    what: 'Apa yang sedang Anda lakukan saat gagal? (opsional)',
    seeData: 'Lihat persis apa yang akan dikirim', consent: 'Saya setuju mengirim diagnostik dan log di atas untuk membantu memperbaiki error ini.',
    attach: 'Lampirkan juga file saya', attachWarn: 'File Anda mungkin berisi data pribadi atau finansial. Lampirkan hanya jika Anda bersedia mengirimkannya ke kami.',
    noFile: 'Tidak ada file yang dimuat untuk tool ini.', send: 'Kirim laporan', sending: 'Mengirim…', cancel: 'Tutup',
    thanksTitle: 'Terima kasih!', thanksBody: 'Laporan Anda membantu kami memperbaikinya untuk semua orang yang mengalami error yang sama. 🙌',
    ref: 'Referensi', failed: 'Maaf — laporan tidak bisa dikirim. Silakan coba lagi.',
    needConsent: 'Centang kotak persetujuan untuk mengirim.',
  },
};

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

export default function ReportDialog({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [open, setOpen] = useState(false);
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [attach, setAttach] = useState(false);
  const [showData, setShowData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneId, setDoneId] = useState('');
  const fileRef = useRef<File | null>(null);
  const tokenRef = useRef('');
  const widgetHost = useRef<HTMLDivElement | null>(null);

  // Recompute diagnostics whenever the dialog opens (captures live logs + file).
  useEffect(() => onOpen(async prefill => {
    breadcrumb('report-dialog-open');
    const ctx = getContext();
    const file = getCurrentFile();
    fileRef.current = file;
    const fileMeta = file ? await sniffFileMeta(file).catch(() => undefined) : undefined;
    setDiag(collectDiagnostics({
      toolId: ctx?.toolId || 'unknown',
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      error: prefill.error ?? takeLastError(),
      file: fileMeta,
    }));
    setMessage(''); setConsent(false); setAttach(false); setShowData(false); setError(''); setDoneId('');
    setOpen(true);
  }), []);

  // Lazy-load Turnstile and render an invisible widget while the dialog is open.
  useEffect(() => {
    if (!open) return;
    if (import.meta.env.DEV) return; // DEV path uses the E2E stub; skip Turnstile
    const w = window as unknown as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => void } };
    const render = () => { if (widgetHost.current && w.turnstile) w.turnstile.render(widgetHost.current, {
      sitekey: TURNSTILE_SITE_KEY, callback: (tok: string) => { tokenRef.current = tok; }, size: 'flexible',
    }); };
    if (w.turnstile) { render(); return; }
    const s = document.createElement('script'); s.src = TURNSTILE_SRC; s.async = true; s.onload = render;
    document.head.appendChild(s);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!consent) { setError(t.needConsent); return; }
    setBusy(true); setError('');
    try {
      const finalDiag = { ...diag!, user: message ? { message } : undefined };
      const { id } = await submitReport(finalDiag, attach ? fileRef.current : null, tokenRef.current);
      setDoneId(id);
    } catch {
      setError(t.failed);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto border-2 border-border bg-background p-4 shadow-brutal">
        {doneId ? (
          <div className="space-y-3" data-testid="report-thanks">
            <h2 className="text-lg font-black uppercase">{t.thanksTitle}</h2>
            <Alert variant="success">{t.thanksBody}</Alert>
            <p className="text-xs text-muted-foreground">{t.ref}: {doneId}</p>
            <Button onClick={() => setOpen(false)}>{t.cancel}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-black uppercase">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.desc}</p>

            <label className="block text-sm font-semibold">{t.what}</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
              className="w-full border-2 border-border bg-muted p-2 text-sm" />

            <button type="button" onClick={() => setShowData(s => !s)} className="text-sm underline">{t.seeData}</button>
            {showData && (
              <pre data-testid="report-diag" className="max-h-40 overflow-auto border-2 border-border bg-muted p-2 text-xs">
                {JSON.stringify(diag, null, 2)}
              </pre>
            )}

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} data-testid="report-consent" />
              <span>{t.consent}</span>
            </label>

            {fileRef.current ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={attach} onChange={e => setAttach(e.target.checked)} />
                <span>{t.attach} <span className="block text-xs text-muted-foreground">{t.attachWarn}</span></span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">{t.noFile}</p>
            )}

            <div ref={widgetHost} />
            {error && <Alert variant="error">{error}</Alert>}

            <div className="flex gap-2">
              <Button onClick={submit} disabled={busy}>{busy ? t.sending : t.send}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>{t.cancel}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit** (island — no unit test; covered by Task 10 E2E)

```bash
git add src/islands/report/ReportDialog.tsx src/config.ts
git commit -m "feat(report): ReportDialog island (consent, Turnstile, thank-you)"
```

---

### Task 9: ReportButton + ToolHost integration

**Files:**
- Create: `src/islands/report/ReportButton.tsx`
- Modify: `src/islands/ToolHost.tsx`

**Interfaces:**
- Consumes: `openReportDialog` from `@/services/report/reporter`; `installGlobalCapture` from `@/services/report/breadcrumbs`; default `ReportDialog`.
- Produces: default export `ReportButton({ lang })`.

- [ ] **Step 1: Write the button**

```tsx
// src/islands/report/ReportButton.tsx
import { openReportDialog } from '@/services/report/reporter';
import type { Lang } from '@/i18n/config';

const LABEL: Record<Lang, string> = { en: 'Report a problem', id: 'Laporkan masalah' };

export default function ReportButton({ lang = 'en' }: { lang?: Lang }) {
  return (
    <button
      type="button"
      onClick={() => openReportDialog()}
      className="text-xs text-muted-foreground underline hover:text-foreground"
    >
      {LABEL[lang] ?? LABEL.en}
    </button>
  );
}
```

- [ ] **Step 2: Wire ToolHost — imports + global capture + render**

In `src/islands/ToolHost.tsx`:

1. Add `useEffect` to the **existing** React import (don't add a second `react` import line — the file already imports `Component, lazy, Suspense, useMemo, type ComponentType, type ReactNode`):

```tsx
import { Component, lazy, Suspense, useEffect, useMemo, type ComponentType, type ReactNode } from 'react';
```

Then add the report imports:

```tsx
import ReportButton from '@/islands/report/ReportButton';
import ReportDialog from '@/islands/report/ReportDialog';
import { installGlobalCapture } from '@/services/report/breadcrumbs';
import { openReportDialog } from '@/services/report/reporter';
```

2. In `ToolErrorBoundary.render()`, add a "Report this crash" button and store the error for the dialog. Replace the fallback `<div>` body's end with a button that opens the dialog prefilled:

```tsx
          <button
            type="button"
            onClick={() => openReportDialog({ error: this.state.error })}
            className="border-2 border-border bg-white px-3 py-1 text-sm font-bold text-black"
          >
            Report this crash
          </button>
```

(Place it after the `<pre>` inside the existing fallback container.)

3. In the `ToolHost` function body, install global capture once and render the button + dialog around the tool:

```tsx
export default function ToolHost({ toolId, lang }: ToolHostProps) {
  const tool = getToolById(toolId);

  useEffect(() => { installGlobalCapture(); }, []);

  const LazyTool = useMemo(() => {
    if (!tool) return null;
    return lazy(tool.load) as unknown as ComponentType<{ lang?: Lang }>;
  }, [toolId, tool]);

  if (!tool || !LazyTool) {
    return <div className="py-12 text-center text-muted-foreground">Tool not found.</div>;
  }

  return (
    <>
      <ToolErrorBoundary>
        <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading tool…</div>}>
          <LazyTool lang={lang} />
        </Suspense>
      </ToolErrorBoundary>
      <div className="mt-6 flex justify-end">
        <ReportButton lang={lang} />
      </div>
      <ReportDialog lang={lang} />
    </>
  );
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit -p tsconfig.json` (expect no errors in the changed files) and `npm run lint` (0 errors).

- [ ] **Step 4: Commit**

```bash
git add src/islands/report/ReportButton.tsx src/islands/ToolHost.tsx
git commit -m "feat(report): ReportButton on every tool page + crash-report + global capture"
```

---

### Task 10: E2E happy path (report flow via dev stub)

**Files:**
- Create: `e2e/tools/report.spec.ts`

- [ ] **Step 1: Write the E2E spec**

```ts
// e2e/tools/report.spec.ts
import { test, expect } from '@playwright/test';

// The reporter uses a DEV-only stub (window.__E2E_REPORT__) so submit bypasses
// the network + Turnstile. The Report button is rendered by ToolHost on every page.
test('opens the report dialog, consents, submits, and shows the thank-you', async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __E2E_REPORT__?: unknown }).__E2E_REPORT__ = { id: 'e2e-123' }; });
  await page.goto('/tools/image-compress');
  await page.waitForLoadState('networkidle').catch(() => {});

  await page.getByRole('button', { name: 'Report a problem' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Transparency: the diagnostics JSON is viewable and names the tool.
  await page.getByText('See exactly what will be sent').click();
  await expect(page.getByTestId('report-diag')).toContainText('image-compress');

  // Submitting without consent is blocked.
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Please tick the consent box to send.')).toBeVisible();

  // Consent → submit → thank-you.
  await page.getByTestId('report-consent').check();
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByTestId('report-thanks')).toBeVisible();
  await expect(page.getByTestId('report-thanks')).toContainText('e2e-123');
});

// Failure case: a rejected submit shows an error and never reaches the thank-you.
test('a failed submit shows an error, not the thank-you', async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __E2E_REPORT__?: unknown }).__E2E_REPORT__ = { fail: true }; });
  await page.goto('/tools/image-compress');
  await page.waitForLoadState('networkidle').catch(() => {});

  await page.getByRole('button', { name: 'Report a problem' }).click();
  await page.getByTestId('report-consent').check();
  await page.getByRole('button', { name: 'Send report' }).click();

  await expect(page.getByText('Sorry — the report could not be sent. Please try again.')).toBeVisible();
  await expect(page.getByTestId('report-thanks')).toHaveCount(0);
});
```

- [ ] **Step 2: Kill stale dev servers, then run the spec**

```bash
lsof -ti:4321 | xargs kill -9 2>/dev/null; pkill -9 -f astro 2>/dev/null
npm run test:e2e -- --grep "opens the report dialog"
```
Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add e2e/tools/report.spec.ts
git commit -m "test(report): e2e happy path for the report dialog"
```

---

### Task 11: Wire the image-compress tool (first hot tool)

**Files:**
- Modify: `src/islands/image/ImageCompress.tsx`

**Interfaces:**
- Consumes: `useReportable`; `setLastError` from `@/services/report/reporter`; `breadcrumb` from `@/services/report/breadcrumbs`.

- [ ] **Step 1: Wire the hook + error capture**

In `src/islands/image/ImageCompress.tsx`:

1. Add imports:

```tsx
import { useReportable } from '@/hooks/useReportable';
import { setLastError } from '@/services/report/reporter';
import { breadcrumb } from '@/services/report/breadcrumbs';
```

2. Register the current file (after the `file` state is declared):

```tsx
  useReportable({ toolId: 'image-compress', file });
```

3. In `onDrop`, leave a breadcrumb:

```tsx
    breadcrumb('image-compress:file-selected', { type: files[0]?.type, size: files[0]?.size });
```

4. In the compress `catch (e)` block, capture the error for the reporter (keep the existing `setError`):

```tsx
    } catch (e) {
      setLastError(e instanceof Error ? e : new Error(String(e)));
      setError(e instanceof Error ? e.message : t.failed);
    }
```

- [ ] **Step 2: Verify unit + lint + build**

```bash
npx vitest run
npm run lint
npm run build
```
Expected: all green; `/tools/image-compress` still builds.

- [ ] **Step 3: Re-run the E2E to confirm wiring**

```bash
lsof -ti:4321 | xargs kill -9 2>/dev/null; pkill -9 -f astro 2>/dev/null
npm run test:e2e -- --grep "opens the report dialog"
```
Expected: 1 passed (the diagnostics now include a file block once a file is loaded; the test asserts `image-compress` regardless).

- [ ] **Step 4: Commit**

```bash
git add src/islands/image/ImageCompress.tsx
git commit -m "feat(report): wire image-compress to the reporter (file + error capture)"
```

---

### Task 12: Full verify loop

- [ ] **Step 1: Unit suite**

Run: `npx vitest run`
Expected: all pass (new report libs + worker handler).

- [ ] **Step 2: E2E**

Run: `lsof -ti:4321 | xargs kill -9 2>/dev/null; pkill -9 -f astro 2>/dev/null; npm run test:e2e`
Expected: render smoke (every tool page still renders with the Report button) + the report happy path pass.

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: 0 lint errors; build succeeds; no new precache-size warning.

- [ ] **Step 4: Manual review (classes tests miss)**

- Resource leaks: Turnstile script added once; the dialog cleans up on close; no dangling object URLs.
- Reference identity: `useReportable` re-registers only on `toolId` change (file read live via ref).
- SSR: no module-scope `window`/`navigator`; guarded everywhere.
- Error/empty paths: file-less report works; oversized file rejected client + server; missing consent blocked; failed submit shows an error, not the thank-you.

---

## Definition of done (MVP)

- Report button appears on every tool page (render smoke still green).
- A consenting user can submit a report and see the thank-you state (E2E green).
- Diagnostics include the environment fingerprint + breadcrumb logs + (when a file is present) claimed-vs-actual format & decode success — the "works on my machine" payload.
- `/api/report` stores reports (+ optional file ≤ 10 MB) in R2 behind Turnstile.
- image-compress is wired (file + error auto-captured).
- Unit + E2E + lint + build all green; identity sweep clean on every commit.

## Post-MVP (Sub-project B — separate spec/plan)

Admin viewer (`/admin/reports` + `/api/admin/reports`), per-IP Durable-Object rate limit, webhook ping enrichment, R2 retention lifecycle (30-day auto-delete), wire the remaining hot tools (redact, OCR, receipt, converters), Privacy-page copy (EN + ID), and gwt-add-tool enforcement that new tools call `useReportable`.
