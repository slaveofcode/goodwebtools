export interface SortLinesOptions {
  /** 'asc' | 'desc' sort, or 'reverse' to flip the current order without sorting. */
  direction?: 'asc' | 'desc' | 'reverse';
  /** Ignore case when ordering. */
  caseInsensitive?: boolean;
  /** Numeric-aware ordering so `item2` comes before `item10`. */
  natural?: boolean;
  /** Order by the key — the text before the first `=` or `:` (env / YAML style). */
  byKey?: boolean;
  /** Trim surrounding whitespace from each line. */
  trimEach?: boolean;
  /** Strip any of these characters from both ends of each line (e.g. `"',`). */
  trimChars?: string;
  /** Remove duplicate lines, keeping the first occurrence. */
  dedupe?: boolean;
  /** Drop lines that are empty after trimming. */
  dropBlanks?: boolean;
}

/** Strip any character in `chars` from both ends of `line`. */
function stripChars(line: string, chars: string): string {
  if (!chars) return line;
  const set = new Set(chars.split(''));
  let start = 0;
  let end = line.length;
  while (start < end && set.has(line[start])) start++;
  while (end > start && set.has(line[end - 1])) end--;
  return line.slice(start, end);
}

/**
 * Reorder the lines of `text`. Line transforms (trim, dedupe, drop-blanks) run
 * first, then the chosen ordering. Pure and DOM-free.
 */
export function sortTextLines(text: string, opts: SortLinesOptions = {}): string {
  const {
    direction = 'asc', caseInsensitive = false, natural = false, byKey = false,
    trimEach = false, trimChars = '', dedupe = false, dropBlanks = false,
  } = opts;

  let lines = text.split('\n');
  if (trimEach) lines = lines.map(l => l.trim());
  if (trimChars) lines = lines.map(l => stripChars(l, trimChars));
  if (dropBlanks) lines = lines.filter(l => l.trim() !== '');
  if (dedupe) {
    const seen = new Set<string>();
    lines = lines.filter(l => (seen.has(l) ? false : (seen.add(l), true)));
  }

  if (direction === 'reverse') return lines.reverse().join('\n');

  const collator = new Intl.Collator(undefined, {
    numeric: natural,
    sensitivity: caseInsensitive ? 'base' : 'variant',
  });
  const keyOf = byKey ? (l: string) => l.split(/[=:]/, 1)[0] : (l: string) => l;
  lines.sort((a, b) => collator.compare(keyOf(a), keyOf(b)));
  if (direction === 'desc') lines.reverse();
  return lines.join('\n');
}
