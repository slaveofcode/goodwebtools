/**
 * Split text into speech-friendly chunks. The Web Speech API mishandles very
 * long utterances (Chrome cuts off past ~32k chars and pause/resume gets flaky),
 * so we break text on sentence boundaries and hard-split anything still too long.
 * Pure — no browser APIs.
 */

export function splitIntoChunks(text: string, maxLen = 200): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?]*\n?|\n/g) ?? [];
  const chunks: string[] = [];
  let cur = '';

  const flush = () => {
    const trimmed = cur.trim();
    if (trimmed) chunks.push(trimmed);
    cur = '';
  };

  for (const s of sentences) {
    if (s.length > maxLen) {
      flush();
      for (let i = 0; i < s.length; i += maxLen) {
        const piece = s.slice(i, i + maxLen).trim();
        if (piece) chunks.push(piece);
      }
      continue;
    }
    if ((cur + s).length > maxLen) flush();
    cur += s;
  }
  flush();
  return chunks;
}
