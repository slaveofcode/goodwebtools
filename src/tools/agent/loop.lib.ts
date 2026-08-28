/**
 * SPIKE (throwaway): pure protocol for a model-driven agentic tool loop.
 *
 * Each turn the model emits ONE JSON action — either call a tool or finish.
 * The runtime executes the tool headlessly, appends the result, and loops. This
 * module builds the system prompt and parses the action; the runtime, tool
 * execution, file upload and model provider live in the island. Pure/testable.
 */

export interface LoopArg { name: string; type: 'string' | 'number' | 'file'; required: boolean; description?: string }
export interface LoopTool { name: string; description: string; args: LoopArg[] }

export type LoopAction =
  | { action: 'call_tool'; tool: string; args: Record<string, string | number> }
  | { action: 'final'; text: string };

/** Build the system prompt describing the JSON action protocol + the tools. */
export function buildSystemPrompt(tools: LoopTool[]): string {
  const toolLines = tools.map(t => {
    const args = t.args.map(a => `${a.name}${a.required ? '' : '?'}:${a.type}`).join(', ');
    return `- ${t.name}(${args}) — ${t.description}`;
  }).join('\n');

  return [
    'You are GoodWebTools\' agent. You complete the user\'s request by calling tools, one step at a time.',
    'On EVERY turn respond with ONLY a single JSON object, no prose, one of:',
    '{"action":"call_tool","tool":"<name>","args":{...}}   — to run a tool',
    '{"action":"final","text":"<message>"}                 — when the task is done or you need to talk',
    'Rules:',
    '- Call one tool per turn. After a tool runs you get its result and can call another or finish.',
    '- Fill args from the conversation. For a file argument, pass the string "UPLOAD" — the app will ask the user for the file.',
    '- Once a tool has produced the result/file the user asked for, respond with "final". Do NOT call the same tool again with the same args.',
    '- When you have the answer/result for the user, use "final".',
    '',
    'Tools:',
    toolLines || '(none)',
  ].join('\n');
}

/**
 * Extract the first brace-balanced `{...}` object starting at `start`, respecting
 * strings/escapes. Small models often append junk or an extra closing brace
 * (`...}}}`), which makes a greedy first-`{`..last-`}` slice fail to parse; this
 * finds the correct end instead.
 */
function balancedObject(s: string, start: number): string | null {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

/** Parse the model's single JSON action, leniently (recover from prose/markdown wrapping). */
export function parseAction(raw: string): LoopAction | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  const candidate = balancedObject(raw, start) ?? raw.slice(start, end + 1);
  try {
    obj = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;

  if (o.action === 'final') {
    return { action: 'final', text: typeof o.text === 'string' ? o.text : '' };
  }
  if (o.action === 'call_tool' && typeof o.tool === 'string' && o.tool) {
    const args: Record<string, string | number> = {};
    if (o.args && typeof o.args === 'object') {
      for (const [k, v] of Object.entries(o.args as Record<string, unknown>)) {
        if (typeof v === 'string' || typeof v === 'number') args[k] = v;
      }
    }
    return { action: 'call_tool', tool: o.tool, args };
  }
  return null;
}
