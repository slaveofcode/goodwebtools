/**
 * Turn arbitrary text into a URL-safe slug. Pure and framework-free.
 * Pairs with the case converter — a slug is essentially kebab-case with
 * diacritics folded and punctuation dropped.
 */

export interface SlugifyOptions {
  /** Word separator (default '-'). */
  separator?: string;
  /** Lowercase the result (default true). */
  lowercase?: boolean;
  /** Strip accents/diacritics, e.g. é → e (default true). */
  stripDiacritics?: boolean;
}

/** Convert text to a clean URL slug. */
export function slugify(input: string, opts: SlugifyOptions = {}): string {
  const { separator = '-', lowercase = true, stripDiacritics = true } = opts;
  let s = input.trim();
  // Decompose accented characters and drop the combining diacritical marks.
  if (stripDiacritics) s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (lowercase) s = s.toLowerCase();
  // Anything that is not a letter or number becomes a word break.
  s = s.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const words = s.split(/\s+/).filter(Boolean);
  return words.join(separator);
}
