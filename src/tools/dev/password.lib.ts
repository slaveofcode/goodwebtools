export const SETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?',
};

export type SetKey = keyof typeof SETS;

// Characters that are easy to confuse in many fonts (O/0, I/l/1, etc.).
export const AMBIGUOUS = 'Il1O0oB8S5Z2|`';

export interface Options {
  length: number;
  enabled: Record<SetKey, boolean>;
  avoidAmbiguous: boolean;
  minNumbers: number;
  minSpecial: number;
}

/**
 * Uniform random integer in [0, maxExclusive) via rejection sampling — same
 * approach Bitwarden uses to avoid the modulo bias of `value % n`.
 */
function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % maxExclusive;
}

/** Cryptographically secure Fisher–Yates shuffle (in place). */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function filterAmbiguous(chars: string, avoid: boolean): string {
  if (!avoid) return chars;
  return chars
    .split('')
    .filter(char => !AMBIGUOUS.includes(char))
    .join('');
}

export function buildPool(enabled: Record<SetKey, boolean>, avoidAmbiguous: boolean): string {
  return (Object.keys(SETS) as SetKey[])
    .filter(key => enabled[key])
    .map(key => filterAmbiguous(SETS[key], avoidAmbiguous))
    .join('');
}

/**
 * Bitwarden-style generation:
 * 1. Seed required minimums (>=1 per enabled set, plus min numbers/special).
 * 2. Fill the rest from the combined pool.
 * 3. Shuffle so required chars aren't in fixed positions.
 * All picks use unbiased `randomInt`.
 */
export function generatePassword(opts: Options): string {
  const { length, enabled, avoidAmbiguous, minNumbers, minSpecial } = opts;

  const lower = filterAmbiguous(SETS.lowercase, avoidAmbiguous);
  const upper = filterAmbiguous(SETS.uppercase, avoidAmbiguous);
  const number = filterAmbiguous(SETS.numbers, avoidAmbiguous);
  const special = filterAmbiguous(SETS.symbols, avoidAmbiguous);
  const all = buildPool(enabled, avoidAmbiguous);
  if (!all) return '';

  const pick = (set: string) => set[randomInt(set.length)];
  const chars: string[] = [];

  // Guaranteed minimums (one each for enabled letter sets, N for numbers/special).
  if (enabled.lowercase) chars.push(pick(lower));
  if (enabled.uppercase) chars.push(pick(upper));
  if (enabled.numbers) {
    for (let i = 0; i < Math.max(minNumbers, 1); i++) chars.push(pick(number));
  }
  if (enabled.symbols) {
    for (let i = 0; i < Math.max(minSpecial, 1); i++) chars.push(pick(special));
  }

  // Fill the remainder from the full pool.
  while (chars.length < length) chars.push(pick(all));

  // If minimums overflowed the target length, keep it exact.
  const trimmed = chars.slice(0, length);
  return shuffle(trimmed).join('');
}

export function strengthLabel(length: number, poolSize: number): { label: string; color: string } {
  const entropy = length * Math.log2(poolSize || 1);
  if (entropy < 40) return { label: 'Weak', color: 'text-red-500' };
  if (entropy < 70) return { label: 'Fair', color: 'text-yellow-500' };
  if (entropy < 100) return { label: 'Strong', color: 'text-green-500' };
  return { label: 'Very strong', color: 'text-green-500' };
}
