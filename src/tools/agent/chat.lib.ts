/**
 * Pure prompt-building + tool-call parsing for the model-backed agent (B).
 * The model (WebLLM) turns a user message into a JSON tool-call over the
 * candidate tools that A's router shortlisted. Kept pure so the prompt shape and
 * the (lenient) JSON parsing are unit-tested without loading a model.
 */

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  slots: { key: string; label: string }[];
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface ToolCall {
  /** Chosen tool id, or null when none fits. */
  toolId: string | null;
  /** Slot values the model filled (only keys the tool declares). */
  params: Record<string, string | number>;
  /** One short sentence for the user. */
  reply: string;
}

/** Build the OpenAI-style message list: a schema+tools system prompt + the user turn. */
export function buildToolCallMessages(userMessage: string, tools: AgentTool[]): ChatMessage[] {
  const toolLines = tools.map(t => {
    const slots = t.slots.length ? ` slots: ${t.slots.map(s => s.key).join(', ')}` : ' slots: none';
    return `- ${t.id}: ${t.description}.${slots}`;
  }).join('\n');

  const system = [
    "You are GoodWebTools' assistant. The user wants to get something done with a browser tool.",
    'Choose the single best tool from the list below, or none if nothing fits.',
    'Respond with ONLY a JSON object, no prose, exactly this shape:',
    '{"toolId": string|null, "params": object, "reply": string}',
    '- toolId: the id of the chosen tool (must be one from the list), or null.',
    '- params: fill the chosen tool\'s slots from the user message (use the slot keys). Omit slots with no value.',
    '- reply: one short, friendly sentence telling the user what you are doing.',
    '',
    'Tools:',
    toolLines || '(none)',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: userMessage },
  ];
}

/**
 * Parse the model's JSON tool-call, leniently: extract the first {...} block
 * (models sometimes wrap it in prose/markdown), validate the shape, and coerce.
 * Returns null if no valid object can be recovered.
 */
export function parseToolCall(text: string): ToolCall | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;

  const toolId = typeof o.toolId === 'string' && o.toolId ? o.toolId : null;
  const reply = typeof o.reply === 'string' ? o.reply : '';
  const params: Record<string, string | number> = {};
  if (o.params && typeof o.params === 'object') {
    for (const [k, v] of Object.entries(o.params as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number') params[k] = v;
    }
  }
  return { toolId, params, reply };
}
