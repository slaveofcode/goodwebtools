# Ask Agent E2E Testing — Design

**Status:** draft for review
**Date:** 2026-08-29
**Goal:** Automatically exercise the Ask Agent chat → route → tool-execution → result flow (the surface we've only tested by hand) with Playwright, deterministically, in CI.

## Problem

`/ask-agent` is the most flow-heavy, least-unit-testable part of GWT: a multi-turn
loop that gates intent, scopes tools, runs executors, handles files, prompts for
params, and pipes outputs. Every bug this session (base-convert scope pollution,
"0 MB" display, the 0.5B "didn't quite catch that", ID phrase routing, settings
reset) was found by hand. We want a suite that catches these automatically.

The blocker is the **model**: the on-device tier needs WebGPU (unavailable/flaky in
CI, 350 MB download, non-deterministic output); the cloud tier needs a live paid
key. Neither is a foundation for reliable tests.

## Key idea: inject a scripted provider

The agent already talks to an abstract `AgentProvider`
(`src/services/agent/provider.ts`):

```ts
interface AgentProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  capable?: boolean;
  chatTools?(messages: ToolMsg[], tools: ToolSpec[]): Promise<ToolTurn>;
}
```

`AskAgent` holds `const [provider, setProvider] = useState<AgentProvider|null>` and
passes it to `useAgentChat(provider)`. So a test can inject a **scripted provider**
that returns canned turns, and Playwright drives the **real UI and real executors**.
The model is the only thing faked; routing, executor logic, file handling, param
prompting, chaining, and persistence are all exercised for real.

### The injection hook (dev-only, tree-shaken from prod)

New module `src/services/agent/e2e-provider.ts`:

```ts
export type ScriptStep =
  | { chat: string }                                   // prompt-loop reply (raw text)
  | { calls: { name: string; args: Record<string, unknown> }[]; text?: string } // tools turn
  | { text: string };                                  // final assistant text, no tool
export function createScriptedProvider(script: ScriptStep[], opts?: { capable?: boolean }): AgentProvider;
```

It replays `script` step by step: `capable:true` steps feed `chatTools` (returns
`{text, calls}`), `capable:false`/`chat` steps feed `chat` (returns raw string).

In `AskAgent`, a guarded effect installs it:

```ts
useEffect(() => {
  if (!import.meta.env.DEV) return;                    // compiled out of prod bundles
  const script = (window as any).__E2E_AGENT__;
  if (!script) return;
  import('@/services/agent/e2e-provider').then(({ createScriptedProvider }) =>
    setProvider(createScriptedProvider(script.steps, { capable: script.capable })));
}, []);
```

Playwright sets `window.__E2E_AGENT__` via `page.addInitScript(...)` before navigation.
Because the whole path is behind `import.meta.env.DEV`, it does not exist in the
production build, so there is no way for a real user to trigger a fake provider.
E2E therefore runs against `npm run dev` (where `import.meta.env.DEV === true`).

## Test layers

### Layer 1 — Mock-provider suite (deterministic, CI)

`@playwright/test` devDependency, `playwright.config.ts` with
`webServer: { command: 'npm run dev', url: 'http://localhost:4321', reuseExistingServer: true }`,
`e2e/agent.spec.ts`. Coverage (the four approved areas):

1. **Core execute + download**
   - script a `base64` tool call → assert `✓ base64:` line + copyable/downloadable result
   - script `json-format` → assert formatted output shown
   - script `terbilang 1500000` **with `capable:false` and a single-candidate query** →
     asserts the deterministic single-candidate shortcut runs the tool *without* the
     model emitting JSON (the 0.5B fix)
2. **Files: attach + multi-file**
   - `page.setInputFiles` a fixture CSV → script `csv-dedupe` → assert dedupe ran, file consumed
   - "merge these pdfs" → assert the **multi-file dropzone prompt** appears (asserting the
     prompt, not a full mupdf merge, keeps it fast); a second test provides two tiny fixture
     PDFs and asserts a merged result is produced (slower, tagged `@heavy`)
3. **Weak-model regressions**
   - single-candidate shortcut (above)
   - `humanSize`: script a tool whose result reports a sub-MB size → assert "KB", never "0 MB"
   - ID phrase routing: "ganti gambar ke webp" with a scripted image-convert call → assert route
   - echo/re-run cap: script a provider that repeats the same tool call → assert it runs once
4. **Settings persistence** (no provider needed)
   - select Cloud + OpenCode preset + toggle proxy → reload → assert restored (the localStorage fix)

Fixtures in `e2e/fixtures/`: a tiny generic CSV, a small PNG, two 1-page PDFs — all
obviously fake/generic content (privacy rule). Executors chosen for the deterministic
suite are the headless-safe ones (base64, json-format, terbilang, csv-dedupe, qr-gen,
image-compress). Heavy/WebGPU executors (bg-remove, video, real pdf-merge) are excluded
or tagged `@heavy` and skipped by default.

`package.json`: `"test:e2e": "playwright test"`.

### Layer 2 — CI workflow

`.github/workflows/e2e.yml`, on PR + push to `develop`/`main`:
install deps (`--legacy-peer-deps`), `npx playwright install --with-deps chromium`,
`npm run test:e2e`. Uploads the Playwright HTML report as an artifact on failure.

### Layer 3 — Real-model smoke (NOT GH-hosted CI)

**Honest constraint:** GitHub-hosted runners have **no GPU/WebGPU**, and the app
requires WebGPU for on-device models (`hasWebGPU`), so a real-model test **cannot run
on standard GH runners**. Options, for you to pick at review time:

- **(a) Manual/local script** — `npm run test:e2e:real` runs a Playwright spec that
  loads the real 0.5B on a WebGPU-capable machine (your Mac), asserts one real
  round-trip. Documented as a pre-release manual step, not automated CI. *(recommended
  — actually runnable)*
- **(b) Self-hosted WebGPU runner** — a `schedule:` nightly workflow targeting a
  self-hosted runner with a GPU. More infra than the project currently has.
- **(c) Drop the real-model layer** — rely on the mock suite + the existing manual
  pre-release checklist.

The spec builds Layers 1–2 unconditionally; Layer 3 defaults to **(a)** unless you
choose otherwise.

## Mobile screenshots (bundled — reuses the Playwright install)

A **throwaway** capture script (scratchpad, gitignored — per your earlier call)
uses device emulation (`iPhone 13`) to shoot: mobile homepage, a mobile tool view,
and — via scroll + tap — the **floating category menu** open. These PNGs go to
`docs/images/` and the README gains a desktop-vs-mobile side-by-side (HTML table so
the two sit next to each other on GitHub).

## Files

- Create: `src/services/agent/e2e-provider.ts` (dev-only scripted provider)
- Create: `playwright.config.ts`, `e2e/agent.spec.ts`, `e2e/fixtures/*`
- Create: `.github/workflows/e2e.yml` (+ optional `test:e2e:real` spec for Layer 3a)
- Modify: `src/islands/agent/AskAgent.tsx` (dev-only injection effect)
- Modify: `package.json` (`@playwright/test` devDep, `test:e2e` script)
- Modify: `README.md` + `docs/images/mobile-*.png` (side-by-side)
- Throwaway (uncommitted): mobile screenshot capture script

## Non-goals

- Testing real model *output quality* (non-deterministic; out of scope)
- Testing WebGPU/ffmpeg/mupdf-heavy executors in the fast suite
- Visual regression / pixel diffing (could come later)

## Testing the test infra

The scripted provider is a small pure module → unit-tested in
`src/services/agent/e2e-provider.test.ts` (replay order, capable vs non-capable).
The Playwright specs are the E2E layer themselves.
</content>
