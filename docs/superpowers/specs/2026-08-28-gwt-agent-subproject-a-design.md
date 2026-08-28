# GWT Client-Side Agent — Sub-project A Design

**Status:** Draft for review
**Date:** 2026-08-28
**Branch:** `feat/ai-agent`

## Context

GoodWebTools has ~180 fully client-side tools. The goal is a small, fully
client-side AI agent — "like ChatGPT in the browser" — that helps people solve
productivity problems and can drive all GWT tools, with no server and privacy
preserved.

The overall vision was decomposed into two subsystems on a shared foundation:

- **Sub-project A (this doc)** — a model-free **agent kernel** plus a natural-
  language command mode in the existing ⌘K palette. Universal (works on every
  device, no download), deterministic, independently shippable and useful.
- **Sub-project B (next)** — a conversational chat panel backed by an on-device
  model (transformers.js / WebGPU) for disambiguation, multi-turn dialogue,
  step-chaining and (later) headless execution.

**Hard requirement:** Sub-project A is **consumed by** Sub-project B. A therefore
delivers a reusable, surface- and engine-agnostic **agent kernel**; B is an
extension that swaps the *decider* (deterministic → model) and the *surface*
(⌘K → chat), reusing A's manifest, router and prefill contract unchanged.

A validation spike (model-free router at `/agent-spike`, committed on this
branch) confirmed the approach: multi-word intent routing + slot extraction work
well; the palette's strict-AND search is unsuitable for NL (fixed with stopword
removal + soft OR scoring); the remaining gap is synonym/intent disambiguation —
exactly the job Sub-project B's model does.

## Goal

A user types a natural-language request into ⌘K (e.g. *"compress my video to
8 MB"*, *"make a QR for hello world"*) and gets the right tool surfaced at the
top, which opens with its inputs pre-filled. Fully client-side, model-free, no
new runtime dependency.

## Architecture: the agent kernel

All three kernel pieces live under `src/tools/agent/` and are pure/framework-free
where possible so both surfaces and both deciders can consume them.

### 1. Tool manifest — `src/tools/agent/manifest.ts`

A structured descriptor per tool, derived from the existing registry plus a
small amount of hand-authored slot metadata:

```ts
export interface ToolSlot {
  key: 'size' | 'number' | 'text' | 'url';  // extend as needed
  label: string;
  required: boolean;
}
export interface ToolManifestEntry {
  id: string;            // ToolDef.id
  route: string;         // ToolDef.route
  description: string;   // NL description (reuses summary/keywords)
  slots: ToolSlot[];     // which prefill params this tool accepts
}
export const toolManifest: ToolManifestEntry[];      // generated from registry + overrides
export function manifestFor(id: string): ToolManifestEntry | undefined;
```

- **A** uses `slots` to know which extracted params a routed tool can take.
- **B** serializes `toolManifest` (id + description + slots) into the model's
  function-calling / tool schema. The same source of truth feeds both.
- Tools with no authored slots default to an empty `slots` array (route-only).

### 2. Router — `src/tools/agent/router.lib.ts` (graduate the spike)

Retrieval + slot extraction, pure and unit-tested. Already prototyped; this
sub-project hardens it:

```ts
export function routeQuery(query: string, limit?: number): RouteResult; // {candidates, params}
export function extractParams(query: string): ExtractedParams;
export function prefillUrl(route: string, params: ExtractedParams): string;
```

Naming reconciliation: the spike's extracted-text field `quoted` is renamed to
`text` so the param key set is uniform across manifest slots, the URL
convention, `usePrefill` and the router — `{ size, number, text, url }`.

Hardening added in A (both surfaced by the spike):
- **Tiebreak** — when multiple tools score equally (e.g. bare "generate"), break
  ties by a stable priority (curated popularity rank, then shorter/more-central
  name match) instead of registry order.
- **Synonym map** — a small curated `SYNONYMS: Record<string,string[]>` folding
  common intent words to tool vocabulary (smaller/shrink/reduce → compress,
  etc.) applied during tokenization.

Engine-agnostic contract: `routeQuery` returns ranked `candidates` + extracted
`params`. **A** takes `candidates[0]` (deterministic decide). **B** passes the
top-K `candidates` + `params` to the model, which decides — same function, same
return shape.

### 3. Prefill contract — `src/hooks/usePrefill.ts` + per-tool adapters

A standard URL convention and a shared hook:

- Convention: `?size=8MB&n=1500&text=hello&url=https://…` (keys match
  `ToolSlot.key`).
- `export function usePrefill(): ExtractedParams` — parses `location.search`
  once on mount (SSR-guarded), returns typed params.
- Each **wired** island calls `usePrefill()` and seeds its initial state from the
  relevant slot; **unwired** islands ignore it (graceful, no error).

v1 wires a curated set (~8–10 highest-traffic, slot-friendly tools): Video
Compressor (`size`), Image Compressor (`size`), QR Generator (`text`), Roman
Numeral (`number`), Terbilang (`number`), Stopwatch/Timer (`number`→minutes),
Unit Converter (`number`), Text Encryption (`text`), URL tools (`url`). The set
is data-driven by the manifest, so expansion is additive.

Both **A** (⌘K "open") and **B** (model opens a tool, and later headless-executes
via the same slot mapping) drive tools exclusively through this contract.

### 4. ⌘K surface — extend `src/components/shell/CommandPalette.tsx`

- On each keystroke, run `routeQuery(query)` alongside the existing
  `searchTools`.
- Show an **agent suggestion row** pinned above normal results **when** the query
  reads as natural language (multi-word, or has extracted params, or weak literal
  match). Copy: `→ {intent summary} · open {Tool}`. `Enter` (or click) navigates
  to `prefillUrl(candidate.route, params)`.
- Normal fuzzy results render unchanged below. If `routeQuery` returns no
  candidates, no agent row appears — pure fallback to today's behavior.
- No new dependency; localized EN/ID like the rest of the palette.

## Data flow

```
type in ⌘K
  → routeQuery(query) ⇒ { candidates, params }
  → render agent-suggestion row (top) + existing search results (below)
  → user selects
  → navigate to prefillUrl(candidate.route, params)
  → target island: usePrefill() seeds initial state
```

Sub-project B later replaces the middle step: `routeQuery` shortlists →
model chooses/among candidates + fills slots from the manifest → same
`prefillUrl` / (headless) slot execution.

## Error handling & edge cases

- No candidates → no agent row; existing search behavior unchanged.
- Params that a tool's manifest doesn't declare → dropped by `prefillUrl`.
- A wired tool receiving a malformed param → falls back to its own default
  (defensive parsing in `usePrefill` + per-tool clamping).
- SSR: `usePrefill` and `routeQuery` never touch `window`/`location` at module
  scope; the hook reads in an effect.

## Testing

- `router.lib.test.ts` — extend for tiebreak ordering and synonym routing.
- `manifest.test.ts` — every manifest entry references a real tool id; declared
  slot keys are within the allowed union.
- `usePrefill` — unit-test the query-string parser (sizes, numbers, text, url;
  malformed inputs) with `renderHook`.
- Per-tool wiring — build + manual smoke (islands aren't unit-tested per repo
  convention).

## Scope

**In scope (A):** manifest, hardened router, prefill contract + ~8–10 wired
tools, ⌘K NL mode, EN/ID copy, tests.

**Out of scope → Sub-project B:** the on-device model, chat-panel surface,
multi-turn conversation, model-driven disambiguation, headless (in-page)
execution, step-chaining across tools.

## Key risks & decisions

- **Per-tool prefill is O(n) work.** Mitigated: manifest-driven, curated starter
  set, tools read params defensively, expansion is additive — never a blocker.
- **Router synonym coverage is finite.** Accepted for A: the curated synonym map
  handles common cases; deeper intent understanding is explicitly B's job (the
  model), which is why the router's contract returns *candidates* for a decider
  rather than a single hard answer.
- **Reuse boundary with B must hold.** Enforced by keeping the decider out of the
  kernel: `routeQuery` never assumes it picks the winner; the ⌘K surface (A) and
  the model (B) are both just deciders over the same candidates.

## Definition of done (A)

Kernel (`manifest`, `router`, `usePrefill`) implemented + unit-tested · ~8–10
tools wired to the prefill contract · ⌘K NL suggestion row live (EN/ID) · full
verify loop green · demonstrated locally on `feat/ai-agent` before any release.
