/**
 * Pure text wrapping for the meme generator. Wraps on word boundaries to fit a
 * pixel width, hard-breaking any single word that is still too wide. The width
 * measurement is injected so this stays framework/canvas-free and testable.
 */

export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';

  const pushHardBroken = (word: string) => {
    let chunk = '';
    for (const ch of word) {
      if (chunk && measure(chunk + ch) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    current = chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    if (measure(word) > maxWidth) {
      pushHardBroken(word);
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
