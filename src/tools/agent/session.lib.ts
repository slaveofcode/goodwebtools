/**
 * Pure multi-turn session state for the model-backed agent (Sub-project B).
 * Tracks the conversation and the "active tool" so follow-ups ("now make it
 * 5 MB") resolve against the previous action. No model or DOM — unit-testable.
 */

export interface SessionTurn { role: 'user' | 'assistant'; text: string; toolId?: string }
export interface Resolution { toolId: string | null; params: Record<string, string | number>; reply: string }
export interface SessionState { turns: SessionTurn[]; activeToolId: string | null; activeParams: Record<string, string | number> }

export function emptySession(): SessionState {
  return { turns: [], activeToolId: null, activeParams: {} };
}

export function recordUser(s: SessionState, text: string): SessionState {
  return { ...s, turns: [...s.turns, { role: 'user', text }] };
}

/**
 * Fold a resolved turn into the session: append the assistant turn and update the
 * active tool. Same tool → params accumulate; a different tool → params reset.
 */
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
