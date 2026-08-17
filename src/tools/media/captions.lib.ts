/**
 * Pure caption-buffer helpers for the live-captions tool. The speech recognition
 * itself (browser Web Speech API) lives in the island; this manages the rolling
 * transcript text. No I/O.
 */

/** Append a finalized chunk to the running transcript, ignoring empty chunks. */
export function appendFinal(buffer: string, chunk: string): string {
  const c = chunk.trim();
  if (!c) return buffer;
  return buffer ? `${buffer} ${c}` : c;
}

/** Keep only the last `maxChars` characters, trimmed to a word boundary. */
export function trimToMaxChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const tail = text.slice(text.length - maxChars);
  const space = tail.indexOf(' ');
  return space >= 0 ? tail.slice(space + 1) : tail;
}
