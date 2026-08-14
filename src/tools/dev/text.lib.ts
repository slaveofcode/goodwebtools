/**
 * Basic text toolkit — counting, case conversion and cleanup. All pure.
 */

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  /** Estimated reading time in minutes (≈200 wpm). */
  readingMinutes: number;
}

/** Count words, characters, sentences, paragraphs, lines and reading time. */
export function countText(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words,
    sentences: (text.match(/[^.!?…]+[.!?…]+/g) || []).length || (trimmed ? 1 : 0),
    paragraphs: text.split(/\n\s*\n/).filter(p => p.trim()).length,
    lines: text === '' ? 0 : text.split('\n').length,
    readingMinutes: words / 200,
  };
}

// --- Case conversion ----------------------------------------------------------

/** Split into word tokens, respecting camelCase and separators. */
function tokens(s: string): string[] {
  return s.match(/[A-Z]{2,}(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+/g) ?? [];
}

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);

export const toUpper = (s: string) => s.toUpperCase();
export const toLower = (s: string) => s.toLowerCase();
export const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
export const sentenceCase = (s: string) =>
  s.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, c => c.toUpperCase());
export const camelCase = (s: string) => tokens(s).map((w, i) => (i === 0 ? w.toLowerCase() : cap(w))).join('');
export const pascalCase = (s: string) => tokens(s).map(cap).join('');
export const snakeCase = (s: string) => tokens(s).map(w => w.toLowerCase()).join('_');
export const kebabCase = (s: string) => tokens(s).map(w => w.toLowerCase()).join('-');
export const constantCase = (s: string) => tokens(s).map(w => w.toUpperCase()).join('_');

export const CASES: { key: string; label: string; fn: (s: string) => string }[] = [
  { key: 'upper', label: 'UPPERCASE', fn: toUpper },
  { key: 'lower', label: 'lowercase', fn: toLower },
  { key: 'title', label: 'Title Case', fn: titleCase },
  { key: 'sentence', label: 'Sentence case', fn: sentenceCase },
  { key: 'camel', label: 'camelCase', fn: camelCase },
  { key: 'pascal', label: 'PascalCase', fn: pascalCase },
  { key: 'snake', label: 'snake_case', fn: snakeCase },
  { key: 'kebab', label: 'kebab-case', fn: kebabCase },
  { key: 'constant', label: 'CONSTANT_CASE', fn: constantCase },
];

// --- Cleanup ------------------------------------------------------------------

export const trimLines = (s: string) => s.split('\n').map(l => l.trim()).join('\n');
export const collapseSpaces = (s: string) => s.replace(/[ \t]{2,}/g, ' ');
export const removeBlankLines = (s: string) => s.split('\n').filter(l => l.trim() !== '').join('\n');
export const removeLineBreaks = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();
export const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');
export const removeAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const dedupeLines = (s: string) => {
  const seen = new Set<string>();
  return s.split('\n').filter(l => (seen.has(l) ? false : (seen.add(l), true))).join('\n');
};
export const sortLines = (s: string) => s.split('\n').sort((a, b) => a.localeCompare(b)).join('\n');

export const CLEANUP_OPS: { key: string; label: string; fn: (s: string) => string }[] = [
  { key: 'trimLines', label: 'Trim each line', fn: trimLines },
  { key: 'collapseSpaces', label: 'Collapse repeated spaces', fn: collapseSpaces },
  { key: 'removeBlankLines', label: 'Remove blank lines', fn: removeBlankLines },
  { key: 'removeLineBreaks', label: 'Remove line breaks (join)', fn: removeLineBreaks },
  { key: 'stripHtml', label: 'Strip HTML tags', fn: stripHtml },
  { key: 'removeAccents', label: 'Remove accents/diacritics', fn: removeAccents },
  { key: 'dedupeLines', label: 'Remove duplicate lines', fn: dedupeLines },
  { key: 'sortLines', label: 'Sort lines A→Z', fn: sortLines },
];

/** Apply the given cleanup op keys in order. */
export function cleanup(text: string, opKeys: string[]): string {
  let out = text;
  for (const op of CLEANUP_OPS) if (opKeys.includes(op.key)) out = op.fn(out);
  return out;
}
