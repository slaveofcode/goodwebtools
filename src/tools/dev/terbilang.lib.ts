/**
 * Terbilang — spell an integer in Indonesian words. Pure.
 *
 * Uses "se-" for one hundred/one thousand/ten/eleven (seratus, seribu,
 * sepuluh, sebelas) and full words for higher scales (satu juta, satu miliar).
 */

const ONES = [
  '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan',
  'sembilan', 'sepuluh', 'sebelas',
];

function words(n: number): string {
  if (n < 12) return ONES[n];
  if (n < 20) return `${words(n - 10)} belas`;
  if (n < 100) {
    const tens = `${words(Math.floor(n / 10))} puluh`;
    return n % 10 ? `${tens} ${words(n % 10)}` : tens;
  }
  if (n < 200) return n % 100 ? `seratus ${words(n % 100)}` : 'seratus';
  if (n < 1000) {
    const h = `${words(Math.floor(n / 100))} ratus`;
    return n % 100 ? `${h} ${words(n % 100)}` : h;
  }
  if (n < 2000) return n % 1000 ? `seribu ${words(n % 1000)}` : 'seribu';
  return scale(n, 1000, 'ribu') ?? scale(n, 1e6, 'juta') ?? scale(n, 1e9, 'miliar') ?? scale(n, 1e12, 'triliun')!;
}

function scale(n: number, unit: number, name: string): string | null {
  if (n >= unit && n < unit * 1000) {
    const head = `${words(Math.floor(n / unit))} ${name}`;
    const rest = n % unit;
    return rest ? `${head} ${words(rest)}` : head;
  }
  return null;
}

/** Spell an integer (rounded, sign-aware) in Indonesian words. */
export function terbilang(value: number): string {
  if (!Number.isFinite(value)) return '';
  const n = Math.round(Math.abs(value));
  if (n === 0) return 'nol';
  const w = words(n).replace(/\s+/g, ' ').trim();
  return value < 0 ? `minus ${w}` : w;
}

/** Spell an amount as Indonesian rupiah (whole-rupiah, "… rupiah"). */
export function terbilangRupiah(value: number): string {
  return `${terbilang(value)} rupiah`;
}

/** Capitalize the first letter (for display). */
export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
