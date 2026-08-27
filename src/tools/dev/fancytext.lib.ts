/**
 * Pure Unicode "fancy text" transforms — maps A–Z/a–z/0–9 to styled Unicode
 * variants (bold, italic, script, etc.) used for social-media bios and posts.
 * These are real Unicode code points, not fonts, so they copy/paste anywhere.
 */

export type StyleId =
  | 'bold' | 'italic' | 'boldItalic' | 'script' | 'doubleStruck'
  | 'monospace' | 'fullwidth' | 'circled' | 'strikethrough' | 'underline';

export const STYLES: { id: StyleId; label: string }[] = [
  { id: 'bold', label: 'Bold' },
  { id: 'italic', label: 'Italic' },
  { id: 'boldItalic', label: 'Bold Italic' },
  { id: 'script', label: 'Script' },
  { id: 'doubleStruck', label: 'Double-struck' },
  { id: 'monospace', label: 'Monospace' },
  { id: 'fullwidth', label: 'Full-width' },
  { id: 'circled', label: 'Circled' },
  { id: 'strikethrough', label: 'Strikethrough' },
  { id: 'underline', label: 'Underline' },
];

interface AlphaMap {
  U: number;   // base code point for 'A'
  L: number;   // base code point for 'a'
  D?: number;  // base code point for '0' (omit if digits unsupported)
  ex?: Record<string, string>; // characters that live outside the contiguous block
}

// Unicode reserves some mathematical letters in the Letterlike Symbols block,
// leaving holes in the otherwise-contiguous ranges — patched via `ex`.
const MAPS: Partial<Record<StyleId, AlphaMap>> = {
  bold: { U: 0x1d400, L: 0x1d41a, D: 0x1d7ce },
  italic: { U: 0x1d434, L: 0x1d44e, ex: { h: 'ℎ' } },
  boldItalic: { U: 0x1d468, L: 0x1d482 },
  monospace: { U: 0x1d670, L: 0x1d68a, D: 0x1d7f6 },
  fullwidth: { U: 0xff21, L: 0xff41, D: 0xff10 },
  doubleStruck: {
    U: 0x1d538, L: 0x1d552, D: 0x1d7d8,
    ex: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' },
  },
  script: {
    U: 0x1d49c, L: 0x1d4b6,
    ex: { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' },
  },
  circled: { U: 0x24b6, L: 0x24d0 }, // digits handled specially (⓪ / ①…)
};

/** Transform ASCII letters/digits in `text` into the given Unicode style. */
export function transform(text: string, style: StyleId): string {
  if (style === 'strikethrough') return [...text].map(c => c + '̶').join('');
  if (style === 'underline') return [...text].map(c => c + '̲').join('');

  const m = MAPS[style];
  if (!m) return text;

  let out = '';
  for (const ch of text) {
    if (m.ex && ch in m.ex) { out += m.ex[ch]; continue; }
    const code = ch.codePointAt(0)!;
    if (ch >= 'A' && ch <= 'Z') out += String.fromCodePoint(m.U + code - 65);
    else if (ch >= 'a' && ch <= 'z') out += String.fromCodePoint(m.L + code - 97);
    else if (ch >= '0' && ch <= '9') {
      if (style === 'circled') out += code === 48 ? '⓪' : String.fromCodePoint(0x2460 + code - 49);
      else if (m.D !== undefined) out += String.fromCodePoint(m.D + code - 48);
      else out += ch;
    } else out += ch;
  }
  return out;
}

/** Every style applied to the same input — for a preview list. */
export function allStyles(text: string): { id: StyleId; label: string; output: string }[] {
  return STYLES.map(s => ({ ...s, output: transform(text, s.id) }));
}
