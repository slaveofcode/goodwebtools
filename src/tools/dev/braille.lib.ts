/**
 * Pure Grade 1 (uncontracted) English Braille translator. Maps letters, digits
 * and common punctuation to Unicode braille cells (U+2800 block), with capital
 * and number indicators. Contracted Grade 2 and BRF embosser output are out of
 * scope. No I/O.
 */

const DOT_VALUE: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 };

function cell(dots: number[]): string {
  return String.fromCodePoint(0x2800 + dots.reduce((sum, d) => sum + DOT_VALUE[d], 0));
}

const LETTERS: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5],
  h: [1, 2, 5], i: [2, 4], j: [2, 4, 5], k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5],
  o: [1, 3, 5], p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
};

const DIGIT_TO_LETTER: Record<string, string> = {
  '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j',
};

const PUNCT: Record<string, number[]> = {
  ',': [2], ';': [2, 3], ':': [2, 5], '.': [2, 5, 6], '?': [2, 3, 6], '!': [2, 3, 5],
  "'": [3], '-': [3, 6],
};

const CAPITAL = cell([6]);
const NUMBER = cell([3, 4, 5, 6]);

export function toBraille(text: string): string {
  let out = '';
  let numberMode = false;
  for (const ch of text) {
    if (ch === ' ' || ch === '\n' || ch === '\t') {
      out += ch;
      numberMode = false;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      if (!numberMode) { out += NUMBER; numberMode = true; }
      out += cell(LETTERS[DIGIT_TO_LETTER[ch]]);
      continue;
    }
    numberMode = false;
    const lower = ch.toLowerCase();
    if (LETTERS[lower]) {
      if (ch !== lower && ch === ch.toUpperCase()) out += CAPITAL;
      out += cell(LETTERS[lower]);
    } else if (PUNCT[ch]) {
      out += cell(PUNCT[ch]);
    }
    // Unsupported characters are dropped.
  }
  return out;
}
