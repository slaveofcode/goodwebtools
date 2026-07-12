export const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

export function parseInBase(value: string, base: number): bigint | null {
  const trimmed = value.trim().toLowerCase().replace(/^0[bxo]/, '');
  if (!trimmed) return null;
  const valid = DIGITS.slice(0, base);
  const b = BigInt(base);
  let result = 0n;
  for (const char of trimmed) {
    const index = valid.indexOf(char);
    if (index === -1) return null;
    result = result * b + BigInt(index);
  }
  return result;
}
