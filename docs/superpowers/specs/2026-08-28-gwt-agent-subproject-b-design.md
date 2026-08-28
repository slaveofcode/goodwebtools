# GWT Client-Side Agent — Sub-project B Design (revised)

**Status:** Draft for review
**Date:** 2026-08-28
**Branch:** `feat/ai-agent`
**Supersedes:** the earlier "conversational router" draft of this file.

## Context

Sub-project A shipped the fully-client-side **agent kernel** (tool manifest +
deterministic NL router + prefill contract) and a ⌘K natural-language mode.

Sub-project B is the **conversational agent** at `/ask-agent`: the user describes
an outcome ("compress my mp3", "make a QR for my site") and the agent **runs the
right tools in the browser** — asking for files/inputs, executing headlessly, and
returning downloads — instead of making the user find and drive each tool page.
This is the product's differentiator: **outcome-driven, not tool-hunting.**

Two throwaway spikes (`/ask-agent`, on this branch) validated the whole design
and its hard parts. Findings that shaped this spec:

- **WebLLM runs on WebGPU** (Qwen2.5-0.5B): first load ~78 s / 350 MB, **cached
  load ~1 s**, **~37 tok/s** warm.
- **A tiny model must NOT pick tools or plan multi-step loops.** A 0.5B mis-picks
  (chose QR for "compress mp3") and loops on broken calls. The fix that made every
  case behave: **the runtime — A's deterministic router/relevance — gates intent
  and scopes which tools the model may call; the model only converses, fills args,
  and (with a capable model) plans within that scope.**
- **0.5B is genuinely useful for the *conversational* layer** (greetings,
  "what can you do?", declining unsupported requests) once an **intent gate**
  keeps it out of the tool loop.
- **Reliable multi-step agentic execution needs a capable model** → **pluggable
  providers**: on-device (selectable size) is the free/private default; **BYO API
  key** (OpenAI/DeepSeek/OpenRouter/OpenCode Zen/Gemini/Groq/Claude) is the smart
  tier. All are called **directly browser → provider, no GWT server**.
- **Headless execution works** via GWT's existing pure libs; **files-in-chat**
  (dropzone message → `File` → executor) works.
- **WebLLM `json_object` mode crashes** without a schema string; we prompt for
  JSON and recover it with a tested lenient parser.

## Goal

A chat agent that, per message, either **chats**, **runs a tool inline**
(upload → process → download, asking for inputs/decisions as needed), or **opens
a tool page pre-filled** when the tool is interactive (not headless). Works with
an on-device model (free, private, best-effort) or the user's own API key (smart
mode). Multi-turn.

## Architecture

### Per-turn pipeline (the reliable core)

```
user message
  → routeQuery(message)                                   [A's router, deterministic]
  → INTENT:
      no candidates            → CHAT mode  (model writes one friendly reply)
      candidate is executable  → TASK mode  (agentic loop over the *scoped* executors)
      candidate is interactive → OPEN mode  (open the tool page pre-filled — A behavior)
      no executor + not sensible → chat "not supported yet"
```

- **CHAT mode:** a plain conversational system prompt + the message → one short
  reply. Any model (incl. 0.5B) handles this.
- **TASK mode:** the runtime scopes the offered tools to the executable
  candidates the router surfaced (the model can only call those). The agentic
  loop runs: model emits a `call_tool`/`final` JSON action → runtime executes the
  tool headlessly (asking for a file/param if the schema requires one) → feeds the
  result back → loops (with repeat/iteration guards) until `final`.
- **OPEN mode:** for interactive tools (whiteboard, games, camera, drawing) that
  can't run headless, the agent navigates to the tool page via A's `prefillUrl`
  and says so — unifying A (open pre-filled) and B (run inline) behind one chat.

### Executor registry

Per **executable** tool, a descriptor that wraps its existing pure lib:

```ts
interface FileSpec { key: string; accept: string; label: string }
interface ParamSpec { key: string; type: 'number' | 'string'; label: string; default?: string | number }
interface AgentExecutor {
  toolId: string;                       // maps to registry + manifest
  match: (query: string) => boolean;    // relevance for TASK-mode scoping
  files: FileSpec[];                     // required file inputs (0..n)
  params: ParamSpec[];                   // required params
  execute(inputs: { files: Record<string, File>; params: Record<string, string | number> },
          onProgress?: (p: number, note?: string) => void): Promise<ExecResult>;
}
interface ExecResult { text?: string; blob?: Blob; filename?: string; dataUrl?: string }
```

Executors call code that already exists and is tested (e.g. `encodeBase64`,
`compressImageToTarget`, `compressVideo` via `ffmpeg.service`, `pdf.lib`). Tools
without an executor are OPEN-mode (fall back to A's prefill).

### Model provider abstraction

```ts
interface AgentProvider { chat(messages: ChatMessage[]): Promise<string> }
```

- **WebLLMProvider** — `@mlc-ai/web-llm` in a **Web Worker**, model id selectable
  (0.5B default … 3B). Lazy, opt-in behind a ~350 MB+ consent gate; WebLLM caches
  weights (Cache API); progress via `initProgressCallback`. **Model management:**
  the panel can **delete the cached weights** (`deleteModelAllInfoInCache`, frees
  the hundreds of MB) and **redownload** (delete + fresh load) — important given
  the model size and for recovering a corrupt cache.
- **OpenAICompatibleProvider** — `POST {baseUrl}/chat/completions`, Bearer key.
  Presets: OpenAI, DeepSeek, OpenRouter, OpenCode Zen, Google Gemini, Groq. Model
  editable.
- **AnthropicProvider** — `POST api.anthropic.com/v1/messages` with
  `anthropic-dangerous-direct-browser-access`.

The loop, intent gate and executors are written against `AgentProvider` — the
provider is swappable at any time from the chat panel.

### Multi-turn

A pure session reducer tracks `turns`, the **active executor** and accumulated
inputs, so follow-ups ("now make it 5 MB", "the other one") resolve against the
previous tool. The model is told the active tool and instructed to keep it when
the user is only adjusting inputs. The router still has authority over scope.

### Surface

The chat panel is the page **`/ask-agent`** (the "Ask agent" header + landing
buttons already navigate there). A model-config panel (source, on-device size,
cloud provider/model/key) sits above the conversation and can be changed anytime.

## Components / files

- `src/tools/agent/loop.lib.ts` (exists) — `buildSystemPrompt`, `parseAction`.
- `src/tools/agent/chat.lib.ts` (exists) — reused for arg-extraction prompts.
- `src/tools/agent/session.lib.ts` (CREATE) — pure multi-turn reducer + tests.
- `src/tools/agent/executors.ts` (CREATE) — the executor registry (starter set).
- `src/services/agent/provider.ts` (CREATE) — `AgentProvider` + WebLLM(worker) /
  OpenAI-compatible / Anthropic implementations; `hasWebGPU()`.
- `src/services/agent/webllm.worker.ts` (CREATE) — MLC web-worker entry.
- `src/hooks/useAgentChat.ts` (CREATE) — orchestrates intent gate + loop + session.
- `src/islands/agent/AskAgent.tsx` (exists, spike) — rebuild as the real panel
  around `useAgentChat`.
- `src/pages/ask-agent.astro` (exists) — de-noindex when shipping.
- `astro.config.mjs` — `web-llm` manualChunk + globIgnore (already done).

## Data flow (TASK mode)

```
message → routeQuery → executable candidates
  → scope executors → buildSystemPrompt(scoped) + history
  → provider.chat → parseAction
      call_tool → resolve executor; if a file/param is missing → prompt in chat;
                  execute(inputs, onProgress) → append result → loop
      final     → show reply
  → session.applyResolution (active executor + inputs)
```

## Error handling

- **No WebGPU AND no key:** chat panel offers only the cloud path; if neither,
  point the user to ⌘K (A) for instant routing.
- **Provider/CORS/API error:** surfaced in chat with the provider message; the
  user can switch provider/key.
- **Loop guard:** bail after N iterations or a repeated identical call; message
  suggests a bigger model / API key (validated in the spike).
- **Unparseable action:** treat as a `final` reply (show text); never spam tools.
- **Executor failure:** feed the error back to the model (it can retry/adjust) and
  show it; never crash the panel.
- **SSR:** island is `client:only`; WebGPU/worker/`window` never touched on server.

## Privacy

On-device is fully private. **Cloud mode sends the conversation (and any pasted
text) to the chosen provider using the user's key, directly from the browser —
never through a GoodWebTools server.** This is an explicit, clearly-labeled
opt-in that departs from the site's default client-side promise; the label and a
one-time confirm make the trade-off obvious. Keys live only in `localStorage`.

## Testing

- `session.lib.test.ts` — reducer (record, input accumulation on same tool,
  switch resets, history window).
- `loop.lib` / `chat.lib` — already unit-tested (prompt build + lenient parse).
- Executors — their underlying pure libs are already unit-tested; a thin
  `executors.ts` test asserts each `toolId` exists in the registry and schemas are
  well-formed.
- Providers, worker engine, panel UI — build + manual smoke (WebGPU/network can't
  run in Vitest).

## Scope

**In (B v1):**
- Two-mode pipeline (intent gate: chat / task / open) with router-scoped tools.
- Agentic executor loop with loop guards + files-in-chat + progress + download.
- Executor registry with a **starter set (~8–12 headless tools)**: base64, hash,
  QR generate, image compress-to-size, image convert/resize, video compress,
  audio/video trim, PDF merge, PDF compress. (Expandable — one executor at a time.)
- OPEN-mode fallback to A's prefill for interactive tools.
- Provider abstraction: on-device (selectable size, **delete-cache + redownload**)
  + OpenAI-compatible presets + Anthropic; BYO key with privacy consent.
- Multi-turn session (adjust-previous-tool follow-ups).
- EN/ID panel copy.

**Out (later):** token streaming; reliable long multi-tool chains on tiny models
(model-dependent, not guaranteed); image/audio *inputs to the model*; server-side
anything; tool auto-discovery of every one of the ~193 tools as an executor (they
graduate in as executors are written).

## Reuse of A

B adds a **decider** (model) and a **surface** (chat panel) around A's unchanged
kernel: `routeQuery` (intent + scope), `manifest` (tool descriptions/slots feed
the prompt), and `prefillUrl`/`usePrefill` (OPEN-mode + executor param seeding).
Nothing in A changes.

## Key risks & decisions

- **Tiny models can't plan.** Structurally mitigated: the router picks/scopes; the
  model never chooses blindly. Worst case degrades to CHAT + single scoped tool.
- **Cloud privacy.** Explicit opt-in, clear labeling, key in `localStorage`,
  direct browser→provider (no GWT server).
- **Provider CORS variance.** Documented; errors are surfaced, user can switch.
- **Executor coverage is O(n).** Curated starter set; additive; interactive tools
  covered by OPEN-mode from day one so nothing is a hard blocker.

## Definition of done (B)

Provider abstraction (on-device worker + selectable size + BYO key) · intent-gate
pipeline (chat / task / open) with router-scoped tools · agentic executor loop
with guards + files-in-chat + downloads · starter executor set (~8–12) ·
`session.lib` multi-turn (tested) · chat panel at `/ask-agent` (EN/ID) · privacy
consent for cloud · full verify loop green · demonstrated locally on
`feat/ai-agent` before any release.
