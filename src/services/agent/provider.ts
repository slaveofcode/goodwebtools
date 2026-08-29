/**
 * Model-provider abstraction for the agent. The intent gate, agentic loop and
 * executors are written against `AgentProvider`, so the model source is
 * swappable: an on-device WebLLM engine (see the worker section) or any cloud
 * endpoint via the user's own API key. Cloud calls go directly browser→provider,
 * never through a GoodWebTools server.
 */

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

// --- Native function-calling ---------------------------------------------------
/** A tool offered to the model (JSON-Schema params), like MCP tools/list. */
export interface ToolSpec { name: string; description: string; parameters: Record<string, unknown> }
/** A tool call the model asked for. */
export interface ToolCall { id: string; name: string; args: Record<string, string | number> }
/** One turn of a native tool loop: assistant text (optional) + tool calls. */
export interface ToolTurn { text: string; calls: ToolCall[] }
/** Messages for the native loop — richer than ChatMessage (carry calls/results). */
export interface ToolMsg {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[]; // on an assistant turn that called tools
  toolCallId?: string;    // on a tool-result turn
}

export interface AgentProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  /** Capable enough to plan over the full tool catalog and chain tools (cloud
   * models). Tiny on-device models are NOT — they get a keyword-scoped subset. */
  capable?: boolean;
  /** Native tool-calling step (present on cloud providers). Uses the provider's
   * real tools API so big args (SVG/code) are encoded reliably, not model-typed. */
  chatTools?(messages: ToolMsg[], tools: ToolSpec[]): Promise<ToolTurn>;
}

/** Coerce a provider's tool-call args object to the scalar shape executors expect. */
function coerceArgs(input: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = typeof v === 'number' ? v : typeof v === 'string' ? v : (typeof v === 'boolean' ? String(v) : JSON.stringify(v));
    }
  }
  return out;
}

/** True when the browser exposes WebGPU (required for the on-device model). */
export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export interface CloudPreset {
  label: string; baseUrl: string; model: string; kind: 'openai' | 'anthropic';
  // Some providers don't send CORS headers, so a browser can't call them directly
  // (their preflight 404s). `proxied` routes the call through the same-origin
  // GoodWebTools worker (/api/llm-proxy), which forwards it server-side. The
  // request + key then pass through our edge (forwarded, never stored) — a
  // deliberate privacy trade-off the user opts into per call.
  proxied?: boolean;
}
export const CLOUD_PRESETS: Record<string, CloudPreset> = {
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', kind: 'openai' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', kind: 'openai' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', kind: 'openai' },
  opencode: { label: 'OpenCode Go', baseUrl: 'https://opencode.ai/zen/go/v1', model: 'glm-5.3-flash', kind: 'openai', proxied: true },
  opencodezen: { label: 'OpenCode Zen', baseUrl: 'https://opencode.ai/zen/v1', model: 'minimax-m2.5-free', kind: 'openai', proxied: true },
  google: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', kind: 'openai' },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', kind: 'openai' },
  anthropic: { label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-haiku-latest', kind: 'anthropic' },
};

export const ONDEVICE_MODELS: { id: string; label: string }[] = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B — ~350 MB, fast (default)' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B — ~750 MB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B — ~1 GB' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 3B — ~1.9 GB, best' },
];

export interface OnDeviceProvider extends AgentProvider { unload(): Promise<void> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapEngine(engine: any, worker?: Worker): OnDeviceProvider {
  return {
    async chat(messages) {
      const res = await engine.chat.completions.create({ messages, temperature: 0.2, max_tokens: 300 });
      return res.choices[0]?.message?.content ?? '';
    },
    async unload() {
      try { await engine.unload(); } catch { /* ignore */ }
      worker?.terminate();
    },
  };
}

/**
 * Create an on-device provider backed by a WebLLM engine. Prefers a Web Worker
 * (keeps the UI responsive); falls back to a main-thread engine if the worker
 * fails to start (e.g. dev bundling). Errors are normalized to a readable string.
 */
export async function createOnDeviceProvider(
  modelId: string,
  onProgress: (p: number, text: string) => void,
): Promise<OnDeviceProvider> {
  const webllm = await import('@mlc-ai/web-llm');
  const cb = { initProgressCallback: (r: { progress: number; text: string }) => onProgress(r.progress, r.text) };
  try {
    const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
    const engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, cb);
    return wrapEngine(engine, worker);
  } catch (workerErr) {
    try {
      const engine = await webllm.CreateMLCEngine(modelId, cb);
      return wrapEngine(engine);
    } catch (mainErr) {
      throw new Error(errText(mainErr) || errText(workerErr) || 'model failed to load');
    }
  }
}

/** Best-effort readable message from an unknown thrown value. */
export function errText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

/** Delete a cached on-device model's weights (frees the hundreds of MB). */
export async function deleteModelCache(modelId: string): Promise<void> {
  const webllm = await import('@mlc-ai/web-llm');
  await webllm.deleteModelAllInfoInCache(modelId);
}

export interface CloudConfig {
  kind: 'openai' | 'anthropic'; baseUrl: string; model: string; apiKey: string;
  // When true, POST to the same-origin worker proxy instead of the provider,
  // naming the real endpoint in `x-llm-target`. For CORS-blocked providers.
  proxy?: boolean;
}

/**
 * Fetch a provider endpoint, either directly or (for CORS-blocked providers)
 * through the same-origin /api/llm-proxy worker route, which forwards the
 * request + auth headers to `target` server-side.
 */
function providerFetch(proxy: boolean | undefined, target: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  if (proxy) {
    return fetch('/api/llm-proxy', { method: 'POST', headers: { ...headers, 'x-llm-target': target }, body: JSON.stringify(body) });
  }
  return fetch(target, { method: 'POST', headers, body: JSON.stringify(body) });
}

/** A provider that calls a cloud chat API with the user's key, from the browser. */
export function createCloudProvider(cfg: CloudConfig): AgentProvider {
  return {
    capable: true,
    async chat(messages) {
      if (cfg.kind === 'anthropic') {
        const system = messages.find(m => m.role === 'system')?.content ?? '';
        const conv = messages
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
        const r = await providerFetch(cfg.proxy, cfg.baseUrl + '/v1/messages', {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        }, { model: cfg.model, max_tokens: 500, system, messages: conv });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error?.message || 'API error');
        return j.content?.[0]?.text ?? '';
      }
      const r = await providerFetch(cfg.proxy, cfg.baseUrl + '/chat/completions', {
        'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}`,
      }, { model: cfg.model, messages, temperature: 0.2, max_tokens: 500 });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'API error');
      return j.choices?.[0]?.message?.content ?? '';
    },

    async chatTools(messages, tools) {
      if (cfg.kind === 'anthropic') {
        const system = messages.find(m => m.role === 'system')?.content ?? '';
        const conv = messages.filter(m => m.role !== 'system').map(m => {
          if (m.role === 'tool') return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }] };
          if (m.role === 'assistant' && m.toolCalls?.length) {
            return { role: 'assistant', content: [
              ...(m.content ? [{ type: 'text', text: m.content }] : []),
              ...m.toolCalls.map(c => ({ type: 'tool_use', id: c.id, name: c.name, input: c.args })),
            ] };
          }
          return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
        });
        const r = await providerFetch(cfg.proxy, cfg.baseUrl + '/v1/messages', {
          'content-type': 'application/json', 'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
        }, { model: cfg.model, max_tokens: 1500, system, tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })), messages: conv });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error?.message || 'API error');
        let text = ''; const calls: ToolCall[] = [];
        for (const b of j.content ?? []) {
          if (b.type === 'text') text += b.text;
          else if (b.type === 'tool_use') calls.push({ id: b.id, name: b.name, args: coerceArgs(b.input) });
        }
        return { text, calls };
      }
      // OpenAI-compatible (GLM, OpenAI, DeepSeek, Groq, Gemini, OpenRouter, OpenCode).
      const msgs = messages.map(m => {
        if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return { role: 'assistant', content: m.content || null, tool_calls: m.toolCalls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) };
        }
        return { role: m.role, content: m.content };
      });
      const r = await providerFetch(cfg.proxy, cfg.baseUrl + '/chat/completions', {
        'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}`,
      }, { model: cfg.model, temperature: 0.2, max_tokens: 1500, tool_choice: 'auto', tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })), messages: msgs });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'API error');
      const msg = j.choices?.[0]?.message ?? {};
      const calls: ToolCall[] = (msg.tool_calls ?? []).map((tc: { id: string; function?: { name: string; arguments?: string } }) => {
        let parsed: unknown = {};
        try { parsed = JSON.parse(tc.function?.arguments || '{}'); } catch { /* keep {} */ }
        return { id: tc.id, name: tc.function?.name ?? '', args: coerceArgs(parsed) };
      });
      return { text: msg.content ?? '', calls };
    },
  };
}
