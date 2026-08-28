# GWT Agent Sub-project A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a model-free "agent kernel" (tool manifest + hardened NL router + prefill contract) and a natural-language command mode in the ⌘K palette, so a typed request routes to the right GWT tool and opens it with inputs pre-filled.

**Architecture:** A pure kernel under `src/tools/agent/` (manifest, router) plus a `usePrefill` hook; the ⌘K palette runs the router alongside its existing search and pins an "agent suggestion" row. The kernel is surface- and engine-agnostic so Sub-project B (chat + on-device model) reuses it unchanged — only the *decider* (deterministic→model) and *surface* (⌘K→chat) swap.

**Tech Stack:** TypeScript, React islands, Astro, Vitest, cmdk (existing palette). No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-08-28-gwt-agent-subproject-a-design.md`

## Global Constraints

- Branch: `feat/ai-agent`. Local testing only — do NOT push/PR/merge to develop or main (user releases manually after local verification).
- Fully client-side, no new runtime dependency, no server calls.
- Param key set is uniform across kernel: `{ size, number, text, url }`.
- SSR safety: no `window`/`location`/`document` at module scope; read them in effects/handlers only.
- Every new tool card/label rule for the repo does NOT apply (this is not a new tool). No `tool-seo.ts` / `tool-i18n.ts` entries needed. ⌘K copy is localized EN/ID via the palette's existing `useLang`.
- No `any` in new source. Run the full verify loop (`npx vitest run`, `npm run lint`, `npm run build`) before finishing.
- Identity: commit as `Kresna <13603341+slaveofcode@users.noreply.github.com>`; no AI-attribution trailers; secret-sweep staged diff before each commit.

---

## File Structure

- `src/tools/agent/router.lib.ts` (MODIFY — exists from spike) — retrieval + slot extraction + confidence; harden with synonyms + tiebreak; rename `quoted`→`text`.
- `src/tools/agent/router.lib.test.ts` (MODIFY) — add synonym + tiebreak tests.
- `src/tools/agent/manifest.ts` (CREATE) — typed tool descriptors with param slots; single source of truth for A's slot-fill and B's function schema.
- `src/tools/agent/manifest.test.ts` (CREATE) — integrity tests.
- `src/hooks/usePrefill.ts` (CREATE) — parse `location.search` → `ExtractedParams`.
- `src/hooks/usePrefill.test.ts` (CREATE) — query-string parser tests (pure helper).
- `src/islands/dev/QrGen.tsx`, `src/islands/calculators/RomanNumeral.tsx`, `src/islands/media/VideoCompress.tsx` (+ curated others) (MODIFY) — seed initial state from `usePrefill()`.
- `src/components/shell/CommandPalette.tsx` (MODIFY) — agent suggestion row.
- `src/pages/agent-spike.astro`, `src/islands/agent/AgentSpike.tsx` (DELETE at end) — throwaway spike; functionality moves to ⌘K.

---

### Task 1: Harden the router (graduate the spike)

**Files:**
- Modify: `src/tools/agent/router.lib.ts`
- Test: `src/tools/agent/router.lib.test.ts`

**Interfaces:**
- Consumes: `tools` from `@/registry/tools`.
- Produces:
  - `interface ExtractedParams { size?: { value: number; unit: 'KB'|'MB'|'GB' }; number?: number; text?: string; url?: string }`
  - `interface RoutedTool { id: string; name: string; route: string; category: string; confidence: number }`
  - `interface RouteResult { candidates: RoutedTool[]; params: ExtractedParams }`
  - `function extractParams(query: string): ExtractedParams`
  - `function routeQuery(query: string, limit?: number): RouteResult`
  - `function prefillUrl(route: string, params: ExtractedParams): string`

- [ ] **Step 1: Write the failing tests** — append to `router.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractParams, routeQuery } from './router.lib';

describe('router hardening', () => {
  it('renames the quoted slot to text', () => {
    expect(extractParams('make a QR for "hello world"').text).toBe('hello world');
  });

  it('routes synonyms of compress to the compressor', () => {
    // "smaller"/"shrink" should reach a compressor even though the tool copy says "compress"
    const ids = routeQuery('shrink my video').candidates.map(c => c.id);
    expect(ids).toContain('video-compress');
  });

  it('breaks ties by popularity, not registry order', () => {
    // "generate" matches many generators; the curated-popular one should lead.
    const top = routeQuery('generate').candidates[0];
    expect(top.id).toBe('qr-code-generator');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/agent/router.lib.test.ts`
Expected: FAIL — `.text` is undefined (currently `quoted`); synonym + popularity assertions fail.

- [ ] **Step 3: Implement the hardening** — in `router.lib.ts`:

Rename `quoted` → `text` in the `ExtractedParams` interface, in `extractParams` (the quoted-match branch assigns `out.text`), and in `prefillUrl` (already sets key `text`, now reads `params.text`).

Add above `scoreTool`:

```ts
// Fold common intent words to tool vocabulary so conversational phrasing routes.
const SYNONYMS: Record<string, string[]> = {
  small: ['compress', 'shrink', 'reduce'],
  smaller: ['compress', 'shrink', 'reduce'],
  shrink: ['compress', 'reduce'],
  reduce: ['compress', 'shrink'],
  bigger: ['upscale', 'enlarge'],
  enlarge: ['upscale'],
  scramble: ['encrypt'],
  translate: ['convert'],
  picture: ['image', 'photo'],
  photo: ['image'],
};

// Curated popularity order used only to break score ties (most popular first).
const POPULARITY: string[] = [
  'qr-code-generator', 'image-compress', 'video-compress', 'pdf-to-word',
  'background-remover', 'password-generator', 'json-format', 'image-resize',
];
```

Expand each query stem with its synonyms in `scoreTool` (any member matching counts). Replace the `for (const qs of queryStems)` body so `best` is the max weight over `[qs, ...(SYNONYMS[qs] ?? [])].map(stem)`:

```ts
function scoreTool(tool: (typeof tools)[number], queryStems: string[]): number {
  let score = 0;
  for (const qs of queryStems) {
    const group = [qs, ...(SYNONYMS[qs] ?? [])].map(stem);
    let best = 0;
    for (const [field, weight] of WEIGHTS) {
      const field_tokens = FIELD_GETTERS[field](tool);
      if (field_tokens.some(ft => group.includes(stem(ft)))) { best = Math.max(best, weight); break; }
    }
    score += best;
  }
  return score;
}
```

In `routeQuery`, change the sort to break ties by popularity then name:

```ts
const rank = (id: string) => { const i = POPULARITY.indexOf(id); return i === -1 ? 999 : i; };
const scored = tools
  .filter(t => !t.desktopOnly)
  .map(tool => ({ tool, score: scoreTool(tool, queryStems) }))
  .filter(({ score }) => score > 0)
  .sort((a, b) => b.score - a.score
    || rank(a.tool.id) - rank(b.tool.id)
    || a.tool.name.localeCompare(b.tool.name));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tools/agent/router.lib.test.ts`
Expected: PASS (all prior tests + the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/tools/agent/router.lib.ts src/tools/agent/router.lib.test.ts
git commit -m "feat(agent): harden router — text slot, synonyms, popularity tiebreak"
```

---

### Task 2: Tool manifest

**Files:**
- Create: `src/tools/agent/manifest.ts`
- Test: `src/tools/agent/manifest.test.ts`

**Interfaces:**
- Consumes: `tools`, `getToolById` from `@/registry/tools`.
- Produces:
  - `type SlotKey = 'size' | 'number' | 'text' | 'url'`
  - `interface ToolSlot { key: SlotKey; label: string; required: boolean }`
  - `interface ToolManifestEntry { id: string; route: string; description: string; slots: ToolSlot[] }`
  - `const toolManifest: ToolManifestEntry[]`
  - `function manifestFor(id: string): ToolManifestEntry | undefined`

- [ ] **Step 1: Write the failing test** — `manifest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toolManifest, manifestFor } from './manifest';
import { getToolById } from '@/registry/tools';

const ALLOWED = new Set(['size', 'number', 'text', 'url']);

describe('toolManifest', () => {
  it('references only real tools', () => {
    for (const e of toolManifest) expect(getToolById(e.id)).toBeDefined();
  });
  it('uses only allowed slot keys', () => {
    for (const e of toolManifest) for (const s of e.slots) expect(ALLOWED.has(s.key)).toBe(true);
  });
  it('carries a description and route from the registry', () => {
    const e = manifestFor('qr-code-generator')!;
    expect(e.route).toBe('/tools/qr-code-generator');
    expect(e.description.length).toBeGreaterThan(0);
    expect(e.slots.map(s => s.key)).toContain('text');
  });
  it('returns undefined for unknown ids', () => {
    expect(manifestFor('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/agent/manifest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `manifest.ts`**

```ts
/**
 * Structured tool descriptors: the single source of truth for both A's
 * deterministic slot-fill and B's model function-calling schema. Descriptions
 * reuse the registry; slots are hand-authored per tool that accepts prefill.
 */
import { tools, getToolById } from '@/registry/tools';

export type SlotKey = 'size' | 'number' | 'text' | 'url';
export interface ToolSlot { key: SlotKey; label: string; required: boolean }
export interface ToolManifestEntry { id: string; route: string; description: string; slots: ToolSlot[] }

// Only tools that accept a prefill param need an entry here; others are route-only.
const SLOT_OVERRIDES: Record<string, ToolSlot[]> = {
  'video-compress': [{ key: 'size', label: 'Target size', required: false }],
  'image-compress': [{ key: 'size', label: 'Target size', required: false }],
  'qr-code-generator': [{ key: 'text', label: 'Text or URL', required: false }],
  'roman-numeral': [{ key: 'number', label: 'Number', required: false }],
  'text-encrypt': [{ key: 'text', label: 'Message', required: false }],
  'timer-stopwatch': [{ key: 'number', label: 'Minutes', required: false }],
  'unit-converter': [{ key: 'number', label: 'Value', required: false }],
};

export const toolManifest: ToolManifestEntry[] = tools
  .filter(t => !t.desktopOnly)
  .map(t => ({
    id: t.id,
    route: t.route,
    description: `${t.name} — ${t.summary}. Keywords: ${t.keywords.join(', ')}`,
    slots: SLOT_OVERRIDES[t.id] ?? [],
  }));

export function manifestFor(id: string): ToolManifestEntry | undefined {
  return getToolById(id) ? toolManifest.find(e => e.id === id) : undefined;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tools/agent/manifest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/agent/manifest.ts src/tools/agent/manifest.test.ts
git commit -m "feat(agent): tool manifest (slots + descriptions) for A and B"
```

---

### Task 3: `usePrefill` hook + pure parser

**Files:**
- Create: `src/hooks/usePrefill.ts`
- Test: `src/hooks/usePrefill.test.ts`

**Interfaces:**
- Consumes: `ExtractedParams` from `@/tools/agent/router.lib`.
- Produces:
  - `function parsePrefill(search: string): ExtractedParams` (pure, exported for testing)
  - `function usePrefill(): ExtractedParams` (React hook)

- [ ] **Step 1: Write the failing test** — `usePrefill.test.ts` (test the pure parser; the hook is a thin wrapper):

```ts
import { describe, it, expect } from 'vitest';
import { parsePrefill } from './usePrefill';

describe('parsePrefill', () => {
  it('parses size', () => {
    expect(parsePrefill('?size=8MB').size).toEqual({ value: 8, unit: 'MB' });
  });
  it('parses number, text, url', () => {
    expect(parsePrefill('?n=2024').number).toBe(2024);
    expect(parsePrefill('?text=hello%20world').text).toBe('hello world');
    expect(parsePrefill('?url=https://x.com').url).toBe('https://x.com');
  });
  it('ignores malformed size and empty search', () => {
    expect(parsePrefill('?size=abc').size).toBeUndefined();
    expect(parsePrefill('')).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/hooks/usePrefill.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `usePrefill.ts`**

```ts
import { useMemo } from 'react';
import type { ExtractedParams, SizeUnit } from '@/tools/agent/router.lib';

/** Parse a `location.search` string into typed prefill params. Pure. */
export function parsePrefill(search: string): ExtractedParams {
  const q = new URLSearchParams(search);
  const out: ExtractedParams = {};

  const size = q.get('size');
  const sizeMatch = size?.match(/^(\d+(?:\.\d+)?)(kb|mb|gb)$/i);
  if (sizeMatch) out.size = { value: Number(sizeMatch[1]), unit: sizeMatch[2].toUpperCase() as SizeUnit };

  const n = q.get('n');
  if (n !== null && n.trim() !== '' && !Number.isNaN(Number(n))) out.number = Number(n);

  const text = q.get('text');
  if (text) out.text = text;

  const url = q.get('url');
  if (url) out.url = url;

  return out;
}

/** Read prefill params from the current URL (SSR-safe: empty during SSR). */
export function usePrefill(): ExtractedParams {
  return useMemo(
    () => (typeof window === 'undefined' ? {} : parsePrefill(window.location.search)),
    [],
  );
}
```

Note: `SizeUnit` must be exported from `router.lib.ts` (it already is per Task 1's `ExtractedParams`). If not exported, add `export type SizeUnit = 'KB' | 'MB' | 'GB';` there.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/hooks/usePrefill.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePrefill.ts src/hooks/usePrefill.test.ts
git commit -m "feat(agent): usePrefill hook + pure query-string parser"
```

---

### Task 4: Wire prefill into the curated tools

**Files:**
- Modify: `src/islands/dev/QrGen.tsx`, `src/islands/calculators/RomanNumeral.tsx`, `src/islands/media/VideoCompress.tsx` (repeat the pattern for the other manifest tools: `image-compress`, `text-encrypt`, `timer-stopwatch`, `unit-converter`).

**Interfaces:**
- Consumes: `usePrefill` from `@/hooks/usePrefill`.
- Produces: no new exports — each island seeds its own initial state.

**Pattern:** call `const prefill = usePrefill();` at the top of the component, then use its value as the initial state via a lazy `useState` initializer so it only applies on first mount and the user can freely edit afterward.

- [ ] **Step 1: Wire QrGen (`text` slot)** — in `src/islands/dev/QrGen.tsx`:

```tsx
import { usePrefill } from '@/hooks/usePrefill';
// inside the component, replace the text state init:
const prefill = usePrefill();
const [text, setText] = useState(prefill.text ?? 'https://goodwebtools.com');
```

- [ ] **Step 2: Wire RomanNumeral (`number` slot)** — in `src/islands/calculators/RomanNumeral.tsx`:

```tsx
import { usePrefill } from '@/hooks/usePrefill';
const prefill = usePrefill();
const [value, setValue] = useState(prefill.number !== undefined ? String(prefill.number) : '');
```

- [ ] **Step 3: Wire VideoCompress (`size` slot)** — in `src/islands/media/VideoCompress.tsx`, seed custom-size mode when a size is given:

```tsx
import { usePrefill } from '@/hooks/usePrefill';
const prefill = usePrefill();
// presetIdx = -1 means "custom"; seed custom value/unit from the prefill size.
const [presetIdx, setPresetIdx] = useState(prefill.size ? -1 : 1);
const [customValue, setCustomValue] = useState(prefill.size ? prefill.size.value : 10);
const [customUnit, setCustomUnit] = useState<SizeUnit>(prefill.size ? prefill.size.unit : 'MB');
```

- [ ] **Step 4: Repeat for the remaining manifest tools** — apply the same lazy-initializer pattern:
  - `image-compress` → `size` (same shape as VideoCompress's custom target).
  - `text-encrypt` → `text` (seed the message textarea state).
  - `timer-stopwatch` → `number` (seed the timer's minutes input; clamp with the existing setter).
  - `unit-converter` → `number` (seed the value input).
  Read each island's existing `useState` for the target field and set its initializer to `prefill.<slot> ?? <existing default>`.

- [ ] **Step 5: Manual verify + build**

Run: `npm run dev`, then open (examples):
- `/tools/qr-code-generator?text=hello%20world` → QR text pre-filled to "hello world".
- `/tools/roman-numeral?n=2024` → input pre-filled to 2024.
- `/tools/video-compress?size=8MB` → target set to Custom, 8 MB.
Then: `npm run build` (must succeed).

- [ ] **Step 6: Commit**

```bash
git add src/islands
git commit -m "feat(agent): wire curated tools to the usePrefill contract"
```

---

### Task 5: ⌘K natural-language suggestion row

**Files:**
- Modify: `src/components/shell/CommandPalette.tsx`

**Interfaces:**
- Consumes: `routeQuery`, `prefillUrl` from `@/tools/agent/router.lib`; `localizePath` (already imported); `useLang` (already imported).
- Produces: no new exports.

**Behavior:** when the typed query reads as natural language — has >1 word OR yields extracted params — compute `routeQuery(search)` and render a single pinned "agent" item at the top of the list; selecting it navigates to `prefillUrl(candidate.route, params)` (locale-prefixed). Existing fuzzy results render unchanged below. When there are no candidates, render nothing extra.

- [ ] **Step 1: Add the routing computation** — near the existing `const results = searchTools(...)`:

```tsx
import { routeQuery, prefillUrl } from '@/tools/agent/router.lib';

const AGENT_COPY: Record<Lang, { heading: string; open: (name: string) => string }> = {
  en: { heading: 'Agent suggestion', open: (n) => `Open ${n}` },
  id: { heading: 'Saran agen', open: (n) => `Buka ${n}` },
};

// inside the component:
const words = search.trim().split(/\s+/).filter(Boolean);
const routed = words.length > 1 ? routeQuery(search, 1) : { candidates: [], params: {} };
const agent = routed.candidates[0];
const agentCopy = AGENT_COPY[lang] ?? AGENT_COPY.en;
```

- [ ] **Step 2: Render the pinned agent row** — as the first child of `<Command.List>`, before the category groups:

```tsx
{agent && (
  <Command.Group
    heading={agentCopy.heading}
    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-accent-foreground"
  >
    <Command.Item
      value={`__agent__ ${search}`}
      onSelect={() => { window.location.href = localizePath(prefillUrl(agent.route, routed.params), lang); }}
      className="flex cursor-pointer items-center gap-3 border-2 border-transparent px-3 py-2 data-[selected=true]:border-border data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
    >
      <span className="text-lg">→</span>
      <div className="flex-1">
        <p className="font-bold">{agentCopy.open(agent.name)}</p>
        <p className="text-sm opacity-80">{search}</p>
      </div>
    </Command.Item>
  </Command.Group>
)}
```

Note: `prefillUrl` returns a route with a query string; `localizePath` must prefix the locale onto the path portion. Verify `localizePath` handles a path that already has `?query` (it operates on the pathname prefix). If it mangles the query, split on `?` first: `localizePath(agent.route, lang) + prefillUrl(agent.route, routed.params).slice(agent.route.length)`.

- [ ] **Step 3: Manual verify**

Run: `npm run dev`, open any page, press ⌘K, type `compress my video to 8mb` → top row reads "Open Video Compressor"; Enter navigates to `/tools/video-compress?size=8MB` (or `/id/tools/...` in ID) with the size pre-filled. Type a single word like `qr` → no agent row (only normal results). Type gibberish → no agent row.

- [ ] **Step 4: Lint + build**

Run: `npm run lint` (0 errors) and `npm run build` (succeeds).

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/CommandPalette.tsx
git commit -m "feat(agent): natural-language suggestion row in ⌘K palette"
```

---

### Task 6: Remove the throwaway spike surface

**Files:**
- Delete: `src/pages/agent-spike.astro`, `src/islands/agent/AgentSpike.tsx`

The router lib graduated into the kernel and the real surface is ⌘K, so the standalone spike page is no longer needed. (`router.lib.ts` and its tests stay.)

- [ ] **Step 1: Delete the spike files**

```bash
git rm src/pages/agent-spike.astro src/islands/agent/AgentSpike.tsx
```

- [ ] **Step 2: Full verify loop**

Run: `npx vitest run` (all green), `npm run lint` (0 errors), `npm run build` (succeeds; `/agent-spike` no longer emitted).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(agent): remove throwaway spike page (superseded by ⌘K)"
```

---

## Self-Review

**Spec coverage:**
- Manifest (spec §1) → Task 2. ✓
- Hardened router: synonyms + tiebreak + text rename (spec §2) → Task 1. ✓
- Prefill contract `usePrefill` + wired tools (spec §3) → Tasks 3–4. ✓
- ⌘K NL mode (spec §4) → Task 5. ✓
- Engine-agnostic kernel reused by B → manifest + `routeQuery` return `candidates`/schema, not a hard decision; documented in Tasks 1–2 interfaces. ✓
- Testing (spec) → router, manifest, usePrefill parser unit tests; per-tool wiring via manual+build. ✓
- Out of scope (model, chat, headless) → not planned. ✓

**Placeholder scan:** No TBD/TODO; each code step shows concrete code. Task 4 Step 4 repeats a documented pattern with the exact slot per tool (not "similar to above" — the pattern + target field are specified). ✓

**Type consistency:** `ExtractedParams` = `{ size, number, text, url }` used identically in router, `usePrefill`, and the palette. `SlotKey` union matches `ExtractedParams` keys. `RoutedTool`/`RouteResult` names consistent across Tasks 1 and 5. `SizeUnit` exported from `router.lib.ts` and imported by `usePrefill`. ✓
