# Ask Agent E2E Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic Playwright E2E suite for `/ask-agent` that drives the real UI and real executors with a scripted (mocked) model provider, plus a CI workflow, a local real-model smoke script, and desktop-vs-mobile README screenshots.

**Architecture:** The agent talks to an abstract `AgentProvider`. Tests inject a dev-only **scripted provider** (via `window.__E2E_AGENT__`, gated behind `import.meta.env.DEV` so it never exists in prod). Playwright sets the script, navigates to `/ask-agent`, and asserts on the real chat/executor output. Real-model coverage is a separate, manually-run spec (GitHub runners have no WebGPU).

**Tech Stack:** Playwright (`@playwright/test`), Vitest (existing), Astro dev server, React island `AskAgent`.

**Spec:** `docs/superpowers/specs/2026-08-29-ask-agent-e2e-design.md`

## Global Constraints

- All new logic is client-side; no server code. (GWT core promise.)
- Commit identity is repo-local `Kresna <13603341+slaveofcode@users.noreply.github.com>`; **no AI-attribution trailers**; secret-sweep the staged diff before every commit.
- The scripted-provider path MUST be behind `import.meta.env.DEV` so it is absent from the production bundle.
- E2E runs against `npm run dev` (dev server, `import.meta.env.DEV === true`), baseURL `http://localhost:4321`.
- Fixtures and screenshots must contain only generic/fake content — no real data, no absolute home-directory paths, no employer content.
- `npm install` uses `--legacy-peer-deps` (committed `.npmrc`).
- Deterministic suite uses only headless-safe executors: `base64`, `json-format`, `terbilang`, `csv-dedupe`. Exclude WebGPU/ffmpeg/mupdf-heavy tools from the fast suite.
- Keep the mobile screenshot capture script **throwaway/uncommitted** (scratchpad), per the user's standing instruction.

---

## File Structure

- `src/services/agent/e2e-provider.ts` — dev-only scripted `AgentProvider` factory.
- `src/services/agent/e2e-provider.test.ts` — Vitest unit tests for the factory.
- `src/islands/agent/AskAgent.tsx` — add dev-only injection effect + a few `data-testid`s.
- `playwright.config.ts` — Playwright config (webServer = dev, chromium project).
- `e2e/helpers.ts` — shared helpers (install script, send a message, selectors).
- `e2e/agent.spec.ts` — the deterministic mock-provider suite (4 coverage areas).
- `e2e/agent-real.spec.ts` — local-only real-model smoke (Layer 3a), skipped unless opted in.
- `e2e/fixtures/` — `sample.csv`, `a.pdf`, `b.pdf` (tiny, generic).
- `.github/workflows/e2e.yml` — CI job running the deterministic suite.
- `package.json` — `@playwright/test` devDep; `test:e2e`, `test:e2e:real` scripts.
- `README.md` + `docs/images/mobile-*.png` — desktop/mobile side-by-side.

---

## Task 1: Scripted provider factory (unit-tested)

**Files:**
- Create: `src/services/agent/e2e-provider.ts`
- Test: `src/services/agent/e2e-provider.test.ts`

**Interfaces:**
- Consumes from `@/services/agent/provider`: `AgentProvider`, `ChatMessage`, `ToolSpec`, `ToolMsg`, `ToolTurn` (`ToolTurn = { text: string; calls: { id: string; name: string; args: Record<string, unknown> }[] }`).
- Produces: `type ScriptStep`, `function createScriptedProvider(steps: ScriptStep[], opts?: { capable?: boolean }): AgentProvider`.

- [ ] **Step 1: Write the failing test**

```ts
// src/services/agent/e2e-provider.test.ts
import { describe, it, expect } from 'vitest';
import { createScriptedProvider } from './e2e-provider';

describe('createScriptedProvider', () => {
  it('replays chatTools steps in order, then ends with an empty final turn', async () => {
    const p = createScriptedProvider(
      [{ calls: [{ name: 'base64', args: { text: 'hi' } }] }],
      { capable: true },
    );
    expect(p.capable).toBe(true);
    const t1 = await p.chatTools!([], []);
    expect(t1.calls.map(c => c.name)).toEqual(['base64']);
    expect(t1.calls[0].id).toBeTruthy();            // an id is generated
    const t2 = await p.chatTools!([], []);           // steps exhausted
    expect(t2.calls).toEqual([]);                    // -> final, loop can stop
  });

  it('replays chat() steps as raw strings', async () => {
    const p = createScriptedProvider([{ chat: 'Hello there!' }], { capable: false });
    expect(p.capable).toBe(false);
    expect(await p.chat([])).toBe('Hello there!');
    expect(await p.chat([])).toBe('');               // exhausted -> empty
  });

  it('supports a final text-only tools turn', async () => {
    const p = createScriptedProvider([{ text: 'done', calls: [] }], { capable: true });
    const t = await p.chatTools!([], []);
    expect(t).toEqual({ text: 'done', calls: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/agent/e2e-provider.test.ts`
Expected: FAIL — `createScriptedProvider` is not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/agent/e2e-provider.ts
import type { AgentProvider, ChatMessage, ToolMsg, ToolSpec, ToolTurn } from './provider';

export type ScriptStep =
  | { chat: string }
  | { calls: { name: string; args: Record<string, unknown> }[]; text?: string }
  | { text: string; calls?: undefined };

/**
 * A deterministic, dev/test-only AgentProvider that replays a fixed script.
 * `chat` steps feed the prompt loop / chat-mode; `calls`/`text` steps feed the
 * native tools loop. Once the script is exhausted, chatTools returns an empty
 * final turn and chat returns '' so the agent loop terminates cleanly.
 */
export function createScriptedProvider(steps: ScriptStep[], opts: { capable?: boolean } = {}): AgentProvider {
  let i = 0;
  let callSeq = 0;
  return {
    capable: opts.capable,
    async chat(_messages: ChatMessage[]): Promise<string> {
      const step = steps[i++];
      if (step && 'chat' in step) return step.chat;
      if (step && 'text' in step) return step.text;
      return '';
    },
    async chatTools(_messages: ToolMsg[], _tools: ToolSpec[]): Promise<ToolTurn> {
      const step = steps[i++];
      if (step && 'calls' in step && step.calls) {
        return { text: step.text ?? '', calls: step.calls.map(c => ({ id: `e2e-${++callSeq}`, name: c.name, args: c.args })) };
      }
      if (step && 'text' in step) return { text: step.text, calls: [] };
      return { text: '', calls: [] };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/agent/e2e-provider.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/agent/e2e-provider.ts src/services/agent/e2e-provider.test.ts
git commit -m "test(agent): scripted AgentProvider for deterministic E2E"
```

---

## Task 2: Dev-only injection hook + stable test ids in AskAgent

**Files:**
- Modify: `src/islands/agent/AskAgent.tsx`

**Interfaces:**
- Consumes: `createScriptedProvider` from Task 1; `setProvider` (existing `useState` setter in AskAgent).
- Produces: a global contract — a test sets `window.__E2E_AGENT__ = { steps: ScriptStep[]; capable?: boolean }` before load; AskAgent installs the scripted provider. Adds `data-testid`s: `agent-messages`, `agent-input`, `agent-send`, `agent-attach-input`.

- [ ] **Step 1: Add the dev-only effect.** After the existing `useState`/`useRef` block and before the return, add (import `useEffect` from React at the top — the file already imports from `'react'`):

```tsx
  // E2E hook: a scripted provider injected by Playwright. Behind import.meta.env.DEV
  // so it is tree-shaken from production — a real user can never trigger it.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const cfg = (window as unknown as { __E2E_AGENT__?: { steps: unknown[]; capable?: boolean } }).__E2E_AGENT__;
    if (!cfg) return;
    import('@/services/agent/e2e-provider').then(({ createScriptedProvider }) =>
      setProvider(createScriptedProvider(cfg.steps as never, { capable: cfg.capable })));
  }, []);
```

- [ ] **Step 2: Add `data-testid`s to the chat + input controls.** In the message list container (the element wrapping `{turns.map(...)}`, around line 149) add `data-testid="agent-messages"`. On the main text input (placeholder `"Tell the agent what you want…"`, ~line 205) add `data-testid="agent-input"`. On the Send button (~line 207) add `data-testid="agent-send"`. On the hidden attach input (`ref={attachInputRef}`, ~line 201) add `data-testid="agent-attach-input"`.

- [ ] **Step 3: Verify the dev build still compiles and prod strips the hook**

Run: `npm run lint && npm run build`
Expected: 0 lint errors; build succeeds. (Manual check: `grep -r "__E2E_AGENT__" dist/` returns nothing — the effect body is behind `import.meta.env.DEV` and dropped from the prod bundle.)

- [ ] **Step 4: Commit**

```bash
git add src/islands/agent/AskAgent.tsx
git commit -m "test(agent): dev-only scripted-provider injection hook + test ids"
```

---

## Task 3: Playwright setup + smoke spec

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/agent.spec.ts` (smoke only for now)
- Modify: `package.json`

**Interfaces:**
- Consumes: the dev-server URL `http://localhost:4321`; `data-testid`s from Task 2.
- Produces: `installAgent(page, script)` and `send(page, text)` helpers used by later tasks.

- [ ] **Step 1: Install Playwright as a devDependency**

Run: `npm install -D @playwright/test --legacy-peer-deps && npx playwright install chromium`
Expected: `@playwright/test` in `package.json` devDependencies; chromium downloaded.

- [ ] **Step 2: Add scripts to `package.json`.** In `"scripts"` add:

```json
    "test:e2e": "playwright test",
    "test:e2e:real": "PLAYWRIGHT_REAL=1 playwright test e2e/agent-real.spec.ts",
```

- [ ] **Step 3: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4321', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 4: Write `e2e/helpers.ts`**

```ts
import type { Page } from '@playwright/test';

export type ScriptStep =
  | { chat: string }
  | { calls: { name: string; args: Record<string, unknown> }[]; text?: string }
  | { text: string };

/** Inject the scripted provider BEFORE navigation, then open /ask-agent. */
export async function installAgent(page: Page, script: { steps: ScriptStep[]; capable?: boolean }) {
  await page.addInitScript(s => { (window as unknown as { __E2E_AGENT__: unknown }).__E2E_AGENT__ = s; }, script);
  await page.goto('/ask-agent');
  // The panel installs the scripted provider on mount; the input is always present.
  await page.getByTestId('agent-input').waitFor();
}

/** Type a message and send it. */
export async function send(page: Page, text: string) {
  await page.getByTestId('agent-input').fill(text);
  await page.getByTestId('agent-send').click();
}
```

- [ ] **Step 5: Write the smoke test in `e2e/agent.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { installAgent, send } from './helpers';

test('chat mode: small talk gets a reply, no tool runs', async ({ page }) => {
  await installAgent(page, { steps: [{ chat: 'Hi! How can I help?' }], capable: false });
  await send(page, 'hello there');
  await expect(page.getByTestId('agent-messages')).toContainText('Hi! How can I help?');
  await expect(page.getByTestId('agent-messages')).not.toContainText('→ ');
});
```

- [ ] **Step 6: Run it**

Run: `npm run test:e2e -- e2e/agent.spec.ts`
Expected: PASS (1 test). If the dev server isn't running, Playwright starts one.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/helpers.ts e2e/agent.spec.ts package.json package-lock.json
git commit -m "test(e2e): Playwright setup + agent smoke test"
```

---

## Task 4: Core execute + download, and the single-candidate shortcut

**Files:**
- Modify: `e2e/agent.spec.ts`

**Interfaces:**
- Consumes: `installAgent`, `send` (Task 3). Executors `base64`, `json-format`, `terbilang` (registry). Result lines render as `✓ <toolId>: <text>`.

- [ ] **Step 1: Add the tests**

```ts
test('runs base64 and shows the result line', async ({ page }) => {
  await installAgent(page, {
    steps: [{ calls: [{ name: 'base64', args: { text: 'hi' } }] }, { text: 'Done.' }],
    capable: true,
  });
  await send(page, 'base64 encode this');
  await expect(page.getByTestId('agent-messages')).toContainText('✓ base64:');
  await expect(page.getByTestId('agent-messages')).toContainText('aGk='); // base64("hi")
});

test('formats JSON via a scripted tool call', async ({ page }) => {
  await installAgent(page, {
    steps: [{ calls: [{ name: 'json-format', args: { text: '{"a":1}' } }] }, { text: 'Done.' }],
    capable: true,
  });
  await send(page, 'format this json');
  await expect(page.getByTestId('agent-messages')).toContainText('✓ json-format:');
});

// Weak-model deterministic path: a single scoped tool runs WITHOUT the model
// emitting JSON (the 0.5B "didn't quite catch that" fix). capable:false, and the
// script's chat is intentionally never consumed because the shortcut bypasses it.
test('single-candidate shortcut runs the tool with no model JSON', async ({ page }) => {
  await installAgent(page, { steps: [{ chat: 'garbage that would not parse' }], capable: false });
  await send(page, 'terbilang 1500000');
  await expect(page.getByTestId('agent-messages')).toContainText('✓ terbilang:');
  await expect(page.getByTestId('agent-messages')).not.toContainText('didn’t quite catch');
});
```

- [ ] **Step 2: Run**

Run: `npm run test:e2e -- e2e/agent.spec.ts`
Expected: PASS (smoke + 3 new). If `terbilang 1500000` scopes to more than one tool, the shortcut won't fire — verify with `node -e "const {scopeExecutors}=require('./src/tools/agent/executors'); console.log(scopeExecutors('terbilang 1500000').map(e=>e.toolId))"` is not runnable directly (TS); instead confirm via the existing unit test `executors.test.ts` which asserts `terbilang` scopes. If more than one, switch the query to `slugify My Title` (also single-candidate) and assert `✓ slugify:`.

- [ ] **Step 3: Commit**

```bash
git add e2e/agent.spec.ts
git commit -m "test(e2e): core execute+download + single-candidate shortcut"
```

---

## Task 5: File attach + multi-file prompt

**Files:**
- Create: `e2e/fixtures/sample.csv`, `e2e/fixtures/a.pdf`, `e2e/fixtures/b.pdf`
- Modify: `e2e/agent.spec.ts`

**Interfaces:**
- Consumes: `agent-attach-input` testid (hidden file input). `csv-dedupe` executor reads the attached CSV's text. Multi-file prompt renders an `input[type="file"][multiple]`.

- [ ] **Step 1: Create the CSV fixture** `e2e/fixtures/sample.csv` (generic, has a duplicate row):

```
name,city
Ada,London
Ada,London
Grace,NYC
```

- [ ] **Step 2: Create two 1-page PDF fixtures.** Generate them (no binary-in-plan): run
`node -e "const {PDFDocument}=require('pdf-lib');(async()=>{for(const n of ['a','b']){const d=await PDFDocument.create();d.addPage([200,200]).drawText(n.toUpperCase());require('fs').writeFileSync('e2e/fixtures/'+n+'.pdf',await d.save());}})()"`
Expected: `e2e/fixtures/a.pdf` and `b.pdf` exist (~1 KB each, generic content).

- [ ] **Step 3: Add the tests**

```ts
import path from 'node:path';

test('consumes an attached CSV and dedupes it', async ({ page }) => {
  await installAgent(page, {
    steps: [{ calls: [{ name: 'csv-dedupe', args: {} }] }, { text: 'Done.' }],
    capable: true,
  });
  await page.getByTestId('agent-attach-input').setInputFiles(path.join(__dirname, 'fixtures/sample.csv'));
  await send(page, 'remove duplicate rows from this csv');
  await expect(page.getByTestId('agent-messages')).toContainText('✓ csv-dedupe:');
  // a Download link is produced for the output blob
  await expect(page.getByRole('link', { name: /download/i })).toBeVisible();
});

test('multi-file tool asks for several files', async ({ page }) => {
  await installAgent(page, {
    steps: [{ calls: [{ name: 'pdf-merge', args: {} }] }, { text: 'Done.' }],
    capable: true,
  });
  await send(page, 'merge these pdfs into one');
  // With no attachment, the app prompts with a multiple file input.
  await expect(page.locator('input[type="file"][multiple]')).toBeVisible();
});
```

- [ ] **Step 4: Run**

Run: `npm run test:e2e -- e2e/agent.spec.ts`
Expected: PASS. If `csv-dedupe` requires a param that gets prompted, check `executors.ts` `csv-dedupe` params; the fixture + scripted empty args should let it run using the attached file. If a Download link doesn't appear because the tool returns text only, assert `✓ csv-dedupe:` text only and drop the link assertion.

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures e2e/agent.spec.ts
git commit -m "test(e2e): file attach (csv-dedupe) + multi-file merge prompt"
```

---

## Task 6: Weak-model regressions + settings persistence

**Files:**
- Modify: `e2e/agent.spec.ts`

**Interfaces:**
- Consumes: `humanSize` behaviour (KB for sub-MB), ID routing (`ganti … ke …`), the once-per-tool echo cap, and localStorage keys `gwt-agent-source`, `gwt-agent-cloud-preset`, `gwt-agent-cloud-model`, `gwt-agent-cloud-proxy`.

- [ ] **Step 1: Add the regression + persistence tests**

```ts
test('echo cap: a repeated tool call runs only once', async ({ page }) => {
  await installAgent(page, {
    steps: [
      { calls: [{ name: 'base64', args: { text: 'hi' } }] },
      { calls: [{ name: 'base64', args: { text: 'hi' } }] }, // duplicate — must be ignored
      { text: 'Done.' },
    ],
    capable: true,
  });
  await send(page, 'base64 encode this');
  await expect(page.getByTestId('agent-messages')).toContainText('✓ base64:');
  const runs = await page.getByText('→ base64', { exact: false }).count();
  expect(runs).toBe(1);
});

test('settings persist across reload', async ({ page }) => {
  await page.goto('/ask-agent');
  await page.getByRole('button', { name: 'Cloud (API key)' }).click();
  await page.getByRole('combobox').first().selectOption({ index: 1 }); // pick a non-default preset
  const preset = await page.getByRole('combobox').first().inputValue();
  await page.reload();
  await page.getByRole('button', { name: 'Cloud (API key)' }).click();
  await expect(page.getByRole('combobox').first()).toHaveValue(preset);
});
```

Note: the `humanSize`/ID-routing behaviours are already locked by Vitest unit tests (`executors.test.ts` `humanSize` + `image-convert`/Bahasa scoping) — the E2E layer covers the *flow*, so we don't duplicate pure-function assertions here. The echo cap and persistence are flow-level and belong in E2E.

- [ ] **Step 2: Run**

Run: `npm run test:e2e -- e2e/agent.spec.ts`
Expected: PASS. If `getByRole('combobox')` is ambiguous (on-device model select vs cloud preset), scope with `page.locator('select').nth(0)` after clicking the Cloud tab, or add a `data-testid="cloud-preset"` to the `<select>` in `AskAgent.tsx` and use it.

- [ ] **Step 3: Commit**

```bash
git add e2e/agent.spec.ts
git commit -m "test(e2e): echo-cap regression + settings persistence"
```

---

## Task 7: CI workflow for the deterministic suite

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: E2E · Ask Agent
on:
  push: { branches: [develop, main] }
  pull_request:
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm install --legacy-peer-deps
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Validate YAML locally**

Run: `node -e "require('js-yaml') ? 0 : 0" 2>/dev/null; npx --yes yaml-lint .github/workflows/e2e.yml || echo 'lint tool optional — visually verify indentation'`
Expected: no YAML syntax errors (or a visual check if the linter isn't present).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci(e2e): run the Ask Agent Playwright suite on PRs"
```

---

## Task 8: Local real-model smoke (Layer 3a)

**Files:**
- Create: `e2e/agent-real.spec.ts`

**Interfaces:**
- Consumes: the real on-device provider path in `AskAgent` (the `On-device` tab, `Load model` button, the "Finish loading" status). Runs ONLY when `PLAYWRIGHT_REAL=1` (set by the `test:e2e:real` script) AND a WebGPU-capable browser is available. Skips otherwise.

- [ ] **Step 1: Write the guarded real-model spec**

```ts
import { test, expect } from '@playwright/test';

// GitHub-hosted runners have no WebGPU; this is a LOCAL pre-release smoke only.
test.skip(!process.env.PLAYWRIGHT_REAL, 'real-model smoke: set PLAYWRIGHT_REAL=1 to run locally');

test('loads the real 0.5B model and completes one round-trip', async ({ page }) => {
  test.setTimeout(180_000); // model download + first inference
  await page.goto('/ask-agent');
  await page.getByRole('button', { name: 'On-device' }).click();
  await page.getByRole('button', { name: 'Load model' }).click();
  await expect(page.getByText(/Finish loading/i)).toBeVisible({ timeout: 150_000 });
  await page.getByTestId('agent-input').fill('encode base64 of hi');
  await page.getByTestId('agent-send').click();
  await expect(page.getByTestId('agent-messages')).toContainText('aGk=', { timeout: 60_000 });
});
```

- [ ] **Step 2: Verify it SKIPS without the env var**

Run: `npm run test:e2e -- e2e/agent-real.spec.ts`
Expected: 1 skipped (no `PLAYWRIGHT_REAL`).

- [ ] **Step 3: (Manual, local, WebGPU machine) run it for real**

Run: `npm run test:e2e:real`
Expected: PASS after the model loads. Document in the PR that this is a manual step; do NOT add it to CI.

- [ ] **Step 4: Commit**

```bash
git add e2e/agent-real.spec.ts
git commit -m "test(e2e): local-only real-model smoke (skipped in CI)"
```

---

## Task 9: Mobile screenshots + README side-by-side

**Files:**
- Create (throwaway, uncommitted): a capture script in the scratchpad dir.
- Create: `docs/images/mobile-hero.png`, `docs/images/mobile-menu.png`
- Modify: `README.md`

**Interfaces:**
- Consumes: the running dev server; the floating category menu that appears on mobile after scrolling the homepage.

- [ ] **Step 1: Write the throwaway capture script** in the scratchpad (NOT committed), e.g. `<scratchpad>/shots.mjs`:

```js
import { chromium, devices } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await page.goto('http://localhost:4321/');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'docs/images/mobile-hero.png' });
// floating category menu: scroll down so the FAB appears, then open it
await page.mouse.wheel(0, 1400);
await page.waitForTimeout(800);
const fab = page.getByRole('button', { name: /categor|menu|top/i }).last();
await fab.click().catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: 'docs/images/mobile-menu.png' });
await b.close();
```

- [ ] **Step 2: Run it**

Run: `node <scratchpad>/shots.mjs`
Expected: `docs/images/mobile-hero.png` and `docs/images/mobile-menu.png` created. Open both (Read tool) to confirm the floating category menu is visible and open, and there is no private data. If the FAB selector misses, inspect the homepage island for the button's `aria-label`/text and adjust the selector, then re-run.

- [ ] **Step 3: Add a desktop-vs-mobile block to `README.md`.** Under the hero image, add:

```html
<table>
  <tr>
    <td width="50%"><img src="docs/images/hero.png" alt="GoodWebTools on desktop — searchable grid of 193 browser tools"></td>
    <td width="25%"><img src="docs/images/mobile-hero.png" alt="GoodWebTools on mobile — responsive tool grid"></td>
    <td width="25%"><img src="docs/images/mobile-menu.png" alt="GoodWebTools mobile floating category menu for quick navigation"></td>
  </tr>
</table>
```

- [ ] **Step 4: Verify the README renders**

Run: `node -e "const s=require('fs').readFileSync('README.md','utf8'); ['mobile-hero.png','mobile-menu.png'].forEach(f=>console.log(f, s.includes(f)?'linked':'MISSING'))"` and confirm both PNGs exist under `docs/images/`.
Expected: both `linked`, both files present.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/images/mobile-hero.png docs/images/mobile-menu.png
git commit -m "docs(readme): desktop vs mobile screenshots + floating category menu"
```

---

## Final verification (after all tasks)

- [ ] `npx vitest run` — whole unit suite green (includes `e2e-provider.test.ts`).
- [ ] `npm run test:e2e` — deterministic Playwright suite green; `agent-real.spec.ts` shows 1 skipped.
- [ ] `npm run lint && npm run build` — 0 errors; `grep -r "__E2E_AGENT__" dist/` returns nothing (prod-stripped).
- [ ] Secret-sweep the full diff; confirm commit identity is the noreply address.
- [ ] Push `develop`; promote `develop → main` per the standard flow if desired (docs + tests are safe to land regardless of the Cloudflare deploy state).

## Self-Review

**Spec coverage:** scripted provider (T1) ✓ · dev-only hook (T2) ✓ · Layer 1 mock suite across all four areas (T3–T6) ✓ · Layer 2 CI (T7) ✓ · Layer 3a local real-model (T8) ✓ · mobile screenshots + README (T9) ✓ · fixtures generic (T5) ✓ · prod-stripping guaranteed by `import.meta.env.DEV` (T2, final verify) ✓.

**Placeholder scan:** no TBD/TODO; every code step has real code; fallbacks (ambiguous selector, tool needing a param) give concrete alternative actions, not vague hand-waving.

**Type consistency:** `ScriptStep` and `createScriptedProvider(steps, {capable})` identical in T1 (impl), T3 (`helpers.ts`), and the `window.__E2E_AGENT__ = { steps, capable }` contract in T2. `ToolTurn`/`ToolCall` shape (`{id,name,args}`) matches `provider.ts`. Result-line format `✓ <toolId>:` matches `useAgentChat` push text. Test ids (`agent-input`, `agent-send`, `agent-messages`, `agent-attach-input`) defined in T2 and used T3–T8 consistently.
</content>
