/**
 * Model-assisted tool selection for open-mode. The deterministic router
 * (router.lib) shortlists candidates across the WHOLE registry; when its top
 * pick is ambiguous, the model chooses among that shortlist. The model may only
 * pick from the ids we pass — it can't invent a tool — so this scales the agent
 * to every tool without letting a small model mis-route. Pure/testable.
 */

export interface ToolChoice { id: string; name: string; summary: string; category: string }

/** System prompt: pick ONE tool id from the shortlist that best fits the request. */
export function buildToolChoicePrompt(choices: ToolChoice[]): string {
  const lines = choices.map(c => `- ${c.id}: ${c.name} (${c.category}) — ${c.summary}`).join('\n');
  return [
    "You match the user's request to ONE GoodWebTools tool from the list below.",
    'Reply with ONLY the tool id (exactly as written), or the word "none" if none of them fit.',
    'Output nothing else — no punctuation, no explanation.',
    '',
    'Tools:',
    lines,
  ].join('\n');
}

/**
 * Extract the chosen tool id from the model's reply. Returns the id (must be one
 * of `validIds`), the sentinel 'none' if it declined, or null if unparseable
 * (caller falls back to the router's top candidate). When several ids appear,
 * the longest wins so 'video-compress' beats a bare 'compress' substring.
 */
export function parseToolChoice(raw: string, validIds: string[]): string | 'none' | null {
  const hits = validIds
    .filter(id => new RegExp(`(^|[^a-z0-9-])${id}([^a-z0-9-]|$)`, 'i').test(raw))
    .sort((a, b) => b.length - a.length);
  if (hits.length) return hits[0];
  if (/\bnone\b/i.test(raw)) return 'none';
  return null;
}
