/** In-call text chat sent over the WebRTC data channel (video call). */

export const MAX_CHAT_LEN = 2000;

/** Encode a chat message; returns null for empty/whitespace-only input. */
export function encodeChat(text: string): string | null {
  const trimmed = text.trim().slice(0, MAX_CHAT_LEN);
  if (!trimmed) return null;
  return JSON.stringify({ kind: 'chat', text: trimmed });
}

/** Decode + validate a chat message. Returns the text, or null if invalid. */
export function decodeChat(raw: string): string | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const m = obj as Record<string, unknown>;
  if (m.kind !== 'chat' || typeof m.text !== 'string') return null;
  const text = m.text.trim().slice(0, MAX_CHAT_LEN);
  return text || null;
}
