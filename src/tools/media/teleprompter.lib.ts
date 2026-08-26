/**
 * Pure logic for the teleprompter: tokenizing a script, the forward-only
 * voice-tracking matcher, and the speed/time maths. Framework-free and tested;
 * the island owns the DOM, scrolling, speech recognition and camera.
 */

export interface Token {
  /** The word as written (with its punctuation), for display. */
  text: string;
  /** Lowercased, punctuation-stripped form used to match spoken words. */
  norm: string;
  /** Character offsets into the original script. */
  start: number;
  end: number;
}

/** Normalize a word for matching: lowercase, keep letters/digits/apostrophes. */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

/** Split a script into word tokens with offsets and a normalized form. */
export function tokenize(script: string): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(script)) !== null) {
    const norm = normalize(m[0]);
    if (!norm) continue; // pure punctuation / dashes carry no spoken word
    out.push({ text: m[0], norm, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Forward-only voice-tracking. Given the normalized script words, the reader's
 * current word index, and the most recent recognized spoken words, return the
 * new index. We look for the spoken tail inside a lookahead window starting at
 * the current position and advance to just past the furthest matched word.
 * Never moves backward; ignores words it can't place.
 */
export function advanceReading(
  scriptWords: string[],
  currentIndex: number,
  spokenWords: string[],
  lookahead = 12,
): number {
  if (currentIndex >= scriptWords.length) return currentIndex;
  const tail = spokenWords.slice(-4).map(w => w.toLowerCase()).filter(Boolean);
  if (!tail.length) return currentIndex;

  const end = Math.min(scriptWords.length, currentIndex + lookahead);
  let best = currentIndex;
  // For each spoken word, find its earliest match at or after the current
  // position within the window; keep the furthest forward hit.
  for (const spoken of tail) {
    for (let j = currentIndex; j < end; j++) {
      if (scriptWords[j] === spoken) {
        if (j + 1 > best) best = j + 1;
        break; // earliest match for this spoken word
      }
    }
  }
  return best;
}

/** Estimated read time (seconds) for a word count at words-per-minute. */
export function readingTime(wordCount: number, wpm: number): number {
  if (wpm <= 0) return 0;
  return (wordCount / wpm) * 60;
}

/** Auto-scroll speed (px/sec) from a words-per-minute target. */
export function scrollSpeed(wpm: number, pxPerWord: number): number {
  return (wpm / 60) * pxPerWord;
}
