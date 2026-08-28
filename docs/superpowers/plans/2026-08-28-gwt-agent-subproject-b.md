# GWT Agent Sub-project B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the validated `/ask-agent` spike into the real conversational executor: a chat panel that classifies each message (chat / run-a-tool / open-a-tool), runs headless tools in-browser (asking for files/params), and works with a pluggable model — on-device WebLLM (worker, size-selectable, deletable) or the user's own API key.

**Architecture:** A deterministic **intent gate** (A's router + executor relevance) decides chat vs task vs open; in task mode the runtime scopes which executors the model may call, runs the agentic loop (`loop.lib`), executes tools via a small **executor registry** wrapping existing pure libs, and feeds results back. A **provider abstraction** swaps on-device WebLLM (in a Web Worker) for any OpenAI-compatible / Anthropic endpoint. Reuses A's kernel (`routeQuery`, `manifest`, `prefill`) unchanged.

**Tech Stack:** TypeScript, React islands, Astro, Vitest, `@mlc-ai/web-llm` (WebGPU, in a Web Worker), `fetch` for cloud providers.

**Spec:** `docs/superpowers/specs/2026-08-28-gwt-agent-subproject-b-design.md`

## Global Constraints

- Branch: `feat/ai-agent`. Local testing only — do NOT push/PR/merge (user releases manually).
- Reuse the already-tested spike modules: `src/tools/agent/loop.lib.ts` (`buildSystemPrompt`, `parseAction`), `src/tools/agent/router.lib.ts` (`routeQuery`), `src/tools/agent/manifest.ts`. Do not rewrite them.
- On-device is private; **cloud sends the conversation to the provider with the user's key, directly browser→provider, no GWT server** — must be labeled + consented.
- WebLLM `response_format:{type:'json_object'}` without a schema crashes; prompt for JSON + `parseAction`/`parseToolCall`.
- WebLLM must run in a **Web Worker** (main-thread inference janks the UI).
- No `any` in new source except the loosely-typed WebLLM engine handle (annotate with an eslint-disable line as the spike does). Full verify loop (`npx vitest run`, `npm run lint`, `npm run build`) before finishing.
- Island is `client:only="react"`; never touch `window`/WebGPU/worker on the server.
- `web-llm` is already a `manualChunk` + globIgnored in `astro.config.mjs` — keep it.
- Commit identity `Kresna <13603341+slaveofcode@users.noreply.github.com>`; no AI-attribution trailers; secret-sweep staged diff each commit.

---

## File Structure

- `src/tools/agent/session.lib.ts` (CREATE) — pure multi-turn reducer.
- `src/tools/agent/executors.ts` (CREATE) — executor registry + `scopeExecutors` + `executorFor`.
- `src/tools/agent/intent.ts` (CREATE) — pure `classifyIntent` (chat / task / open).
- `src/services/agent/provider.ts` (CREATE) — `AgentProvider` + on-device/cloud impls + `hasWebGPU` + cache mgmt.
- `src/services/agent/webllm.worker.ts` (CREATE) — MLC web-worker entry.
- `src/hooks/useAgentChat.ts` (CREATE) — orchestration (intent gate + scoped loop + session + provider).
- `src/islands/agent/AskAgent.tsx` (REWRITE) — the panel, built around `useAgentChat`.
- Existing/reused: `loop.lib.ts`, `chat.lib.ts`, `router.lib.ts`, `manifest.ts`, `usePrefill.ts`.

---

### Task 1: Multi-turn session reducer

**Files:**
- Create: `src/tools/agent/session.lib.ts`
- Test: `src/tools/agent/session.lib.test.ts`

**Interfaces:**
- Produces:
  - `interface SessionTurn { role: 'user' | 'assistant'; text: string; toolId?: string }`
  - `interface Resolution { toolId: string | null; params: Record<string, string | number>; reply: string }`
  - `interface SessionState { turns: SessionTurn[]; activeToolId: string | null; activeParams: Record<string, string | number> }`
  - `function emptySession(): SessionState`
  - `function recordUser(s: SessionState, text: string): SessionState`
  - `function applyResolution(s: SessionState, r: Resolution): SessionState`
  - `function historyForPrompt(s: SessionState, maxTurns: number): SessionTurn[]`

- [ ] **Step 1: Write the failing test** — `session.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { emptySession, recordUser, applyResolution, historyForPrompt } from './session.lib';

describe('session reducer', () => {
  it('records a user turn', () => {
    const s = recordUser(emptySession(), 'compress my video');
    expect(s.turns).toEqual([{ role: 'user', text: 'compress my video' }]);
  });
  it('sets the active tool and accumulates params on the same tool', () => {
    let s = applyResolution(emptySession(), { toolId: 'video-compress', params: { size: '8MB' }, reply: 'ok' });
    expect(s.activeToolId).toBe('video-compress');
    s = applyResolution(s, { toolId: 'video-compress', params: { size: '5MB' }, reply: 'smaller' });
    expect(s.activeParams).toEqual({ size: '5MB' }); // later value wins, params accumulate
    expect(s.turns.at(-1)).toEqual({ role: 'assistant', text: 'smaller', toolId: 'video-compress' });
  });
  it('resets params when the tool switches', () => {
    let s = applyResolution(emptySession(), { toolId: 'video-compress', params: { size: '8MB' }, reply: 'a' });
    s = applyResolution(s, { toolId: 'qr-gen', params: { text: 'hi' }, reply: 'b' });
    expect(s.activeToolId).toBe('qr-gen');
    expect(s.activeParams).toEqual({ text: 'hi' });
  });
  it('windows history to the last N turns', () => {
    let s = emptySession();
    for (let i = 0; i < 5; i++) s = recordUser(s, `m${i}`);
    expect(historyForPrompt(s, 2).map(t => t.text)).toEqual(['m3', 'm4']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/agent/session.lib.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `session.lib.ts`**

```ts
export interface SessionTurn { role: 'user' | 'assistant'; text: string; toolId?: string }
export interface Resolution { toolId: string | null; params: Record<string, string | number>; reply: string }
export interface SessionState { turns: SessionTurn[]; activeToolId: string | null; activeParams: Record<string, string | number> }

export function emptySession(): SessionState {
  return { turns: [], activeToolId: null, activeParams: {} };
}

export function recordUser(s: SessionState, text: string): SessionState {
  return { ...s, turns: [...s.turns, { role: 'user', text }] };
}

export function applyResolution(s: SessionState, r: Resolution): SessionState {
  const sameTool = r.toolId !== null && r.toolId === s.activeToolId;
  const activeParams = sameTool ? { ...s.activeParams, ...r.params } : { ...r.params };
  return {
    turns: [...s.turns, { role: 'assistant', text: r.reply, toolId: r.toolId ?? undefined }],
    activeToolId: r.toolId ?? s.activeToolId,
    activeParams: r.toolId ? activeParams : s.activeParams,
  };
}

export function historyForPrompt(s: SessionState, maxTurns: number): SessionTurn[] {
  return s.turns.slice(-maxTurns);
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/tools/agent/session.lib.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/agent/session.lib.ts src/tools/agent/session.lib.test.ts
git commit -m "feat(agent-b): multi-turn session reducer"
```

---

### Task 2: Executor registry + relevance scoping

**Files:**
- Create: `src/tools/agent/executors.ts`
- Test: `src/tools/agent/executors.test.ts`

**Interfaces:**
- Consumes: `getToolById` from `@/registry/tools`.
- Produces:
  - `interface FileSpec { key: string; accept: string; label: string }`
  - `interface ParamSpec { key: string; type: 'number' | 'string'; label: string; default?: string | number }`
  - `interface ExecResult { text?: string; blob?: Blob; filename?: string; dataUrl?: string }`
  - `interface AgentExecutor { toolId: string; description: string; match: (q: string) => boolean; files: FileSpec[]; params: ParamSpec[]; execute: (inputs: { files: Record<string, File>; params: Record<string, string | number> }, onProgress?: (p: number, note?: string) => void) => Promise<ExecResult> }`
  - `const AGENT_EXECUTORS: AgentExecutor[]`
  - `function scopeExecutors(query: string): AgentExecutor[]`
  - `function executorFor(toolId: string): AgentExecutor | undefined`

Starter set (v1): `base64` (text), `hash-text` (text), `qr-gen` (text), `image-compress`→ maps to compress-to-size behaviour (file+size), `video-compress` (file+size), `media-trim` (file+range). Execute fns dynamic-import existing libs (`base64.lib`, `hash` service, `qrcode`, `image-to-size.lib`, `ffmpeg.service`). Interactive tools have no executor (→ open mode).

- [ ] **Step 1: Write the failing test** (integrity + scoping — the pure parts; execute fns are browser-only, smoke-tested later):

```ts
import { describe, it, expect } from 'vitest';
import { AGENT_EXECUTORS, scopeExecutors, executorFor } from './executors';
import { getToolById } from '@/registry/tools';

describe('executor registry', () => {
  it('every executor maps to a real tool and declares a match fn', () => {
    for (const e of AGENT_EXECUTORS) {
      expect(getToolById(e.toolId), e.toolId).toBeDefined();
      expect(typeof e.match).toBe('function');
    }
  });
  it('scopes to base64 for an encode request and not for a qr request', () => {
    expect(scopeExecutors('encode base64 of hi').map(e => e.toolId)).toContain('base64');
    expect(scopeExecutors('make a qr for hello').map(e => e.toolId)).toContain('qr-gen');
  });
  it('does not scope image_compress for a plain mp3 request', () => {
    expect(scopeExecutors('compress my mp3').map(e => e.toolId)).not.toContain('image-compress');
  });
  it('executorFor finds by id', () => {
    expect(executorFor('qr-gen')?.toolId).toBe('qr-gen');
    expect(executorFor('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/tools/agent/executors.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `executors.ts`** — registry with `match` regexes and dynamic-import execute fns. Example entries (repeat the pattern for each):

```ts
import { getToolById } from '@/registry/tools';

export interface FileSpec { key: string; accept: string; label: string }
export interface ParamSpec { key: string; type: 'number' | 'string'; label: string; default?: string | number }
export interface ExecResult { text?: string; blob?: Blob; filename?: string; dataUrl?: string }
export interface AgentExecutor {
  toolId: string; description: string; match: (q: string) => boolean;
  files: FileSpec[]; params: ParamSpec[];
  execute: (inputs: { files: Record<string, File>; params: Record<string, string | number> }, onProgress?: (p: number, note?: string) => void) => Promise<ExecResult>;
}

const re = (r: RegExp) => (q: string) => r.test(q);

export const AGENT_EXECUTORS: AgentExecutor[] = [
  {
    toolId: 'base64', description: 'Encode text to Base64', match: re(/base64|encode|decode/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Text' }],
    execute: async ({ params }) => {
      const { encodeBase64 } = await import('@/tools/dev/base64.lib');
      return { text: encodeBase64(String(params.text ?? '')) };
    },
  },
  {
    toolId: 'qr-gen', description: 'Make a QR code from text', match: re(/\bqr\b|qr ?code|barcode/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Text or URL' }],
    execute: async ({ params }) => {
      const QRCode = (await import('qrcode')).default;
      return { dataUrl: await QRCode.toDataURL(String(params.text ?? '')), filename: 'qr.png' };
    },
  },
  {
    toolId: 'image-compress', description: 'Compress an image to a target size',
    match: re(/(image|photo|picture|jpe?g|png|webp).*(compress|small|reduce|shrink|kb|mb|size)|(compress|small|reduce|shrink).*(image|photo|picture|jpe?g|png|webp)/i),
    files: [{ key: 'file', accept: 'image/*', label: 'Image' }], params: [{ key: 'targetKb', type: 'number', label: 'Target KB', default: 200 }],
    execute: async ({ files, params }) => {
      const { compressImageToTarget } = await import('@/tools/image/image-to-size.lib');
      const r = await compressImageToTarget(files.file, (Number(params.targetKb) || 200) * 1024, 'jpeg');
      return { blob: r.blob, filename: 'compressed.jpg', text: `compressed to ${Math.round(r.blob.size / 1024)} KB` };
    },
  },
  // video-compress, media-trim, hash-text: same shape, dynamic-importing ffmpeg.service / hash libs.
];

export function scopeExecutors(query: string): AgentExecutor[] {
  return AGENT_EXECUTORS.filter(e => e.match(query));
}
export function executorFor(toolId: string): AgentExecutor | undefined {
  return AGENT_EXECUTORS.find(e => e.toolId === toolId);
}
```

Note: verify each `toolId` string against `src/registry/tools.ts` (e.g. `base64`, `qr-gen`, `image-compress`, `video-compress`, `media-trim`, `hash-text`) — the integrity test enforces this. Add the `video-compress`, `media-trim`, `hash-text` entries following the same pattern (file+size for video, file+start/end for trim, text for hash) using `@/services/ffmpeg.service` + the compress lib from `src/tools/media/video-compress.lib.ts` and `src/tools/media/trim.lib.ts`.

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/tools/agent/executors.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/agent/executors.ts src/tools/agent/executors.test.ts
git commit -m "feat(agent-b): executor registry + relevance scoping (starter set)"
```

---

### Task 3: Intent gate (`classifyIntent`)

**Files:**
- Create: `src/tools/agent/intent.ts`
- Test: `src/tools/agent/intent.test.ts`

**Interfaces:**
- Consumes: `routeQuery` from `./router.lib`; `scopeExecutors`, `AgentExecutor` from `./executors`.
- Produces:
  - `type Intent = { mode: 'chat' } | { mode: 'task'; executors: AgentExecutor[] } | { mode: 'open'; toolId: string; route: string }`
  - `function classifyIntent(query: string): Intent`

- [ ] **Step 1: Write the failing test** — `intent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyIntent } from './intent';

describe('classifyIntent', () => {
  it('chats when the router finds no tool', () => {
    expect(classifyIntent('hi there').mode).toBe('chat');
  });
  it('tasks when an executor matches', () => {
    const i = classifyIntent('make a qr for hello');
    expect(i.mode).toBe('task');
    if (i.mode === 'task') expect(i.executors.map(e => e.toolId)).toContain('qr-gen');
  });
  it('opens a tool page when the router matches but no executor exists', () => {
    // whiteboard is interactive → no executor → open mode
    const i = classifyIntent('open a whiteboard to draw');
    expect(i.mode).toBe('open');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/tools/agent/intent.test.ts` → FAIL.

- [ ] **Step 3: Implement `intent.ts`**

```ts
import { routeQuery } from './router.lib';
import { scopeExecutors, type AgentExecutor } from './executors';

export type Intent =
  | { mode: 'chat' }
  | { mode: 'task'; executors: AgentExecutor[] }
  | { mode: 'open'; toolId: string; route: string };

export function classifyIntent(query: string): Intent {
  const executors = scopeExecutors(query);
  if (executors.length > 0) return { mode: 'task', executors };
  const routed = routeQuery(query, 1);
  if (routed.candidates.length === 0) return { mode: 'chat' };
  const top = routed.candidates[0];
  return { mode: 'open', toolId: top.id, route: top.route };
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/tools/agent/intent.test.ts` → PASS. (If the "open" test picks a tool that happens to match an executor regex, choose a clearly-interactive query like "open a whiteboard".)

- [ ] **Step 5: Commit**

```bash
git add src/tools/agent/intent.ts src/tools/agent/intent.test.ts
git commit -m "feat(agent-b): intent gate — chat / task / open"
```

---

### Task 4: Provider abstraction (cloud + WebGPU detection)

**Files:**
- Create: `src/services/agent/provider.ts`

**Interfaces:**
- Produces:
  - `interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }`
  - `interface AgentProvider { chat(messages: ChatMessage[]): Promise<string> }`
  - `function hasWebGPU(): boolean`
  - `interface CloudConfig { kind: 'openai' | 'anthropic'; baseUrl: string; model: string; apiKey: string }`
  - `const CLOUD_PRESETS: Record<string, { label: string; baseUrl: string; model: string; kind: 'openai' | 'anthropic' }>`
  - `function createCloudProvider(cfg: CloudConfig): AgentProvider`

Not unit-tested (network). Concrete code, ported from the spike:

- [ ] **Step 1: Implement `provider.ts`** — the `CLOUD_PRESETS` (OpenAI, DeepSeek, OpenRouter, OpenCode Zen `https://opencode.ai/zen/v1`, Google Gemini `https://generativelanguage.googleapis.com/v1beta/openai`, Groq, Anthropic), `hasWebGPU()` = `typeof navigator !== 'undefined' && 'gpu' in navigator`, and `createCloudProvider` doing the OpenAI-compatible vs Anthropic `fetch` (Anthropic uses `x-api-key` + `anthropic-version` + `anthropic-dangerous-direct-browser-access`, system message split out) — exactly as the spike's `chat()` function does today. Throw on `!res.ok` with the provider's error message.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep provider || echo ok`

- [ ] **Step 3: Commit**

```bash
git add src/services/agent/provider.ts
git commit -m "feat(agent-b): AgentProvider + cloud (OpenAI-compatible/Anthropic) + hasWebGPU"
```

---

### Task 5: On-device WebLLM provider in a Web Worker (+ cache mgmt)

**Files:**
- Create: `src/services/agent/webllm.worker.ts`
- Modify: `src/services/agent/provider.ts`

**Interfaces:**
- Produces (in `provider.ts`):
  - `async function createOnDeviceProvider(modelId: string, onProgress: (p: number, text: string) => void): Promise<AgentProvider & { unload(): Promise<void> }>`
  - `async function deleteModelCache(modelId: string): Promise<void>`
  - `const ONDEVICE_MODELS: { id: string; label: string }[]`

- [ ] **Step 1: Implement the worker** — `webllm.worker.ts`:

```ts
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
```

- [ ] **Step 2: Implement the provider factory** — in `provider.ts`:

```ts
export const ONDEVICE_MODELS = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B — ~350 MB, fast (default)' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B — ~750 MB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B — ~1 GB' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 3B — ~1.9 GB, best' },
];

export async function createOnDeviceProvider(modelId: string, onProgress: (p: number, text: string) => void) {
  const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
  const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
  const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
    initProgressCallback: (r) => onProgress(r.progress, r.text),
  });
  return {
    chat: async (messages) => {
      const res = await engine.chat.completions.create({ messages, temperature: 0.2, max_tokens: 300 });
      return res.choices[0]?.message?.content ?? '';
    },
    unload: async () => { try { await engine.unload(); } catch { /* ignore */ } worker.terminate(); },
  };
}

export async function deleteModelCache(modelId: string): Promise<void> {
  const webllm = await import('@mlc-ai/web-llm');
  await webllm.deleteModelAllInfoInCache(modelId);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | grep -iE "error|web-llm|worker" | grep -ivE "python|terser|eval" | head`
Expected: builds; the worker chunk is emitted; no fatal error. Confirm `web-llm` stays globIgnored (no precache warning).

- [ ] **Step 4: Commit**

```bash
git add src/services/agent/webllm.worker.ts src/services/agent/provider.ts
git commit -m "feat(agent-b): on-device WebLLM provider in a Web Worker + cache delete"
```

---

### Task 6: Orchestration hook (`useAgentChat`)

**Files:**
- Create: `src/hooks/useAgentChat.ts`

**Interfaces:**
- Consumes: `classifyIntent` (`intent.ts`), `executorFor` (`executors.ts`), `buildSystemPrompt`/`parseAction` (`loop.lib.ts`), `session.lib`, `AgentProvider` (`provider.ts`), `prefillUrl` (`router.lib.ts`).
- Produces:
  - `interface ChatUiTurn { role: 'user' | 'assistant'; text: string; blobUrl?: string; imgUrl?: string; filename?: string; href?: string }`
  - `function useAgentChat(provider: AgentProvider | null): { turns: ChatUiTurn[]; busy: boolean; pendingFile: { label: string } | null; send(text: string): Promise<void>; provideFile(f: File): void }`

- [ ] **Step 1: Implement the hook** — port the spike's `run()` into a provider-agnostic hook. Behavior per message:
  1. `session = recordUser(session, text)`; add UI turn.
  2. `const intent = classifyIntent(text)`.
  3. **chat:** `provider.chat([{system: friendly}, {user: text}])` → assistant turn; `applyResolution(session, {toolId:null, params:{}, reply})`.
  4. **open:** push an assistant turn with `href = prefillUrl(intent.route, {})` ("Opening <tool> for you") and stop.
  5. **task:** run the agentic loop over `intent.executors`:
     - `buildSystemPrompt(intent.executors.map(toLoopTool))` + history.
     - loop (max 8, repeat-guard as in the spike): `provider.chat` → `parseAction`.
       - `final` → assistant turn; done.
       - `call_tool` → `executorFor(action.tool)`; if it declares a `file` and none provided → set `pendingFile`, await `provideFile` (promise+ref, as in the spike); run `execute({files, params}, onProgress)`; push result turn (text / imgUrl / blobUrl+download); feed `TOOL_RESULT …` back into the convo; `applyResolution`.
  Reuse the spike's exact guard, file-request promise, and blob-URL rendering. Keep a single in-flight request (`busy`).

- [ ] **Step 2: Verify it compiles** — `npx tsc --noEmit -p tsconfig.json 2>&1 | grep useAgentChat || echo ok`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAgentChat.ts
git commit -m "feat(agent-b): useAgentChat orchestration (intent gate + scoped loop + session)"
```

---

### Task 7: Rebuild the `/ask-agent` panel around the hook

**Files:**
- Modify: `src/islands/agent/AskAgent.tsx`

- [ ] **Step 1: Rewrite the panel** — keep the spike's model-config panel (source toggle, on-device model select + Load/Reload/**Redownload**/**Delete cache**, cloud preset/model/key + privacy warning) but drive the provider through `provider.ts` (`createOnDeviceProvider`, `createCloudProvider`, `deleteModelCache`, `hasWebGPU`, `ONDEVICE_MODELS`, `CLOUD_PRESETS`). Render the conversation from `useAgentChat(provider)`: turns (text / QR image / download / open link), the `pendingFile` dropzone, and the input box. On non-WebGPU with no key, show a note linking to ⌘K (A). Localize the panel copy EN/ID via `useLang`.

- [ ] **Step 2: Manual verify (localhost)**

Run: `npm run dev`, open `/ask-agent`:
- On-device 0.5B: "hi" → friendly reply; "make a qr for hello" → QR + download; "compress this image to 100kb" → dropzone → compressed download; "compress mp3" → routes to the audio executor (or open/ "not supported" if none) — never a wrong tool.
- Cloud: paste a key → same requests run reliably end-to-end.
- Delete cache / Redownload work; UI stays responsive during load (worker).

- [ ] **Step 3: Verify loop** — `npx vitest run` (green), `npm run lint` (0 errors), `npm run build` (succeeds, `web-llm` not precached).

- [ ] **Step 4: Commit**

```bash
git add src/islands/agent/AskAgent.tsx
git commit -m "feat(agent-b): real /ask-agent panel — providers, worker, delete/redownload, intent-gated executor chat"
```

---

### Task 8: De-noindex + docs (ship-ready toggle)

**Files:**
- Modify: `src/pages/ask-agent.astro`

- [ ] **Step 1:** Leave `noindex` **on** while unreleased. Add a one-line comment that it should be removed when B ships to production (do not remove it now — the branch is local-only until the user decides).

- [ ] **Step 2: Commit**

```bash
git add src/pages/ask-agent.astro
git commit -m "chore(agent-b): note noindex removal at ship time for /ask-agent"
```

---

## Self-Review

**Spec coverage:**
- Per-turn intent gate (chat/task/open) → Task 3 (`classifyIntent`) + Task 6 (hook). ✓
- Runtime-scoped executors → Task 2 (`scopeExecutors`) + Task 6. ✓
- Executor registry (starter set) + headless execution + files-in-chat → Task 2 + Task 6. ✓
- Provider abstraction (on-device worker + size selector + delete/redownload; cloud OpenAI-compatible + Anthropic; BYO key) → Tasks 4–5 + Task 7. ✓
- Multi-turn session → Task 1 + Task 6. ✓
- Open-mode fallback to A's prefill → Task 3 + Task 6. ✓
- Privacy consent/labeling → Task 7 (cloud panel warning). ✓
- Reuse of A (`routeQuery`/`manifest`/`prefill`) → Tasks 2/3/6. ✓
- Testing (session, executors, intent pure-tested; provider/worker/UI manual) → Tasks 1–3 tests + Task 7 manual. ✓
- Model management (delete/redownload) → Task 5 + Task 7. ✓
- Out-of-scope (streaming, guaranteed long chains, model file inputs) → not planned. ✓

**Placeholder scan:** No TBD/TODO; each code step shows concrete code. Task 2 notes the remaining executor entries follow the shown pattern with the exact libs named (video-compress.lib, trim.lib, ffmpeg.service, hash) — a documented pattern, not a placeholder.

**Type consistency:** `ChatMessage`/`AgentProvider` shared by provider + hook. `AgentExecutor`/`ExecResult`/`FileSpec`/`ParamSpec` from Task 2 used by Tasks 3/6. `Resolution`/`SessionState` from Task 1 used by Task 6. `Intent` union from Task 3 consumed by Task 6. `parseAction`/`buildSystemPrompt` come from the existing `loop.lib.ts`. Consistent.
