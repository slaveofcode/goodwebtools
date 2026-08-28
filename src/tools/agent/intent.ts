/**
 * Deterministic intent gate for the agent. Decides — before any model runs —
 * whether a message is small talk (chat), a task the runtime can execute (task,
 * with the scoped executors the model may call), or a request for an interactive
 * tool that must open its page pre-filled (open). This is what keeps a tiny model
 * from mis-picking: the runtime, not the model, sets the scope.
 */
import { routeQuery, type RoutedTool, type ExtractedParams } from './router.lib';
import { scopeExecutors, executorFor, type AgentExecutor } from './executors';

export type Intent =
  | { mode: 'chat' }
  | { mode: 'task'; executors: AgentExecutor[]; continued?: boolean }
  | { mode: 'open'; candidates: RoutedTool[]; params: ExtractedParams };

// A follow-up that tweaks the previous action rather than starting a new task:
// a size/quantity ("50kb", "1.5 mb", "80%") or an adjust phrase ("make it
// smaller", "again", "to 300"). Used only when a tool is already active.
const CONTINUATION = /\b\d+(\.\d+)?\s?(kb|mb|gb|%|px|k|m)\b|\b(make it|instead|again|smaller|bigger|larger|lower|higher|reduce|to \d)/i;

// Questions about the agent itself — must chat, not route to a tool. Otherwise
// "what model are you" matches the browser-info tool (it has a "model" keyword).
const META = /\b(who are you|what are you|which model|what model are you|are you (an? )?(ai|llm|bot|gpt|model|human)|your name|what can you do|what do you do|how do you work|are you (chatgpt|claude|gpt|gemini))\b/i;

/**
 * Decide how to handle a message. `activeToolId` (the tool from the previous
 * turn, if any) lets a bare parameter follow-up like "50kb" continue that tool
 * instead of being re-routed from scratch — which otherwise sends "compress to
 * 50kb" to the wrong tool because the message no longer contains "image".
 */
export function classifyIntent(query: string, activeToolId?: string | null): Intent {
  if (META.test(query)) return { mode: 'chat' };

  const scoped = scopeExecutors(query);
  const isContinuation = !!activeToolId && CONTINUATION.test(query);
  const active = activeToolId ? executorFor(activeToolId) : undefined;

  if (scoped.length > 0) {
    // The message clearly scopes to tool(s). If it's a tweak of the active tool,
    // pin to it (and mark continued so the runtime reuses the uploaded file);
    // otherwise the user genuinely switched tools.
    if (active && isContinuation && scoped.some(e => e.toolId === activeToolId)) {
      return { mode: 'task', executors: [active], continued: true };
    }
    return { mode: 'task', executors: scoped };
  }

  // No new tool scoped, but a tweak of the active executor → keep going on it.
  if (active && isContinuation) return { mode: 'task', executors: [active], continued: true };

  // Open-mode covers the WHOLE registry: shortlist the top candidates so the
  // runtime (or, when ambiguous, the model) can pick the best fit and open it.
  const routed = routeQuery(query, 6);
  if (routed.candidates.length === 0) return { mode: 'chat' };
  return { mode: 'open', candidates: routed.candidates, params: routed.params };
}
