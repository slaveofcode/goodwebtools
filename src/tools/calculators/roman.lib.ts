/**
 * Roman numeral conversion, both directions. Pure and framework-free.
 * Standard form covers 1–3999 (no vinculum/overline for larger values).
 */

const NUMERALS: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export const ROMAN_MIN = 1;
export const ROMAN_MAX = 3999;

/** Integer → Roman numeral. Throws for out-of-range or non-integers. */
export function toRoman(n: number): string {
  if (!Number.isInteger(n)) throw new Error('Enter a whole number.');
  if (n < ROMAN_MIN || n > ROMAN_MAX) throw new Error('Number must be between 1 and 3999.');
  let out = '';
  let rem = n;
  for (const [value, sym] of NUMERALS) {
    while (rem >= value) { out += sym; rem -= value; }
  }
  return out;
}

/**
 * Roman numeral → integer. Case-insensitive; validates that the input is a
 * well-formed numeral (so 'IIII' or 'IC' are rejected, not silently accepted).
 */
export function fromRoman(input: string): number {
  const s = input.trim().toUpperCase();
  if (!s) throw new Error('Enter a Roman numeral.');
  if (!/^[MDCLXVI]+$/.test(s)) throw new Error('Only the letters M, D, C, L, X, V and I are allowed.');
  const val: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = val[s[i]];
    const next = i + 1 < s.length ? val[s[i + 1]] : 0;
    total += cur < next ? -cur : cur;
  }
  // Round-trip check catches malformed numerals like 'IIII' or 'VX'.
  if (toRoman(total) !== s) throw new Error('That is not a valid Roman numeral.');
  return total;
}

/** True if the string is a valid Roman numeral in range. */
export function isValidRoman(input: string): boolean {
  try { fromRoman(input); return true; } catch { return false; }
}
