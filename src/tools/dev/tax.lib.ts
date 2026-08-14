/**
 * Indonesian invoice tax maths — PPN (VAT) and PPh (withholding). Pure.
 * Amounts are rounded to whole rupiah, as on tax invoices.
 */

export interface PpnResult {
  dpp: number; // taxable base
  ppn: number; // VAT amount
  total: number; // dpp + ppn
}

export interface PphResult {
  pph: number; // amount withheld
  net: number; // base minus withholding
}

export const PPN_RATES = [11, 12] as const;

export const PPH_PRESETS: { label: string; rate: number }[] = [
  { label: 'PPh 23 — Jasa (2%)', rate: 0.02 },
  { label: 'PPh 23 — Sewa & Royalti (15%)', rate: 0.15 },
  { label: 'PPh 4(2) — Sewa tanah/bangunan (10%)', rate: 0.1 },
  { label: 'PPh 22 — Umum (1.5%)', rate: 0.015 },
  { label: 'PPh 26 — WP luar negeri (20%)', rate: 0.2 },
  { label: 'PPh Final UMKM (0.5%)', rate: 0.005 },
];

/**
 * Compute PPN. When `inclusive`, `amount` already contains the VAT and is split
 * into base + VAT; otherwise `amount` is the base and VAT is added on top.
 */
export function computePpn(amount: number, rate: number, inclusive: boolean): PpnResult {
  if (inclusive) {
    const dpp = Math.round(amount / (1 + rate));
    return { dpp, ppn: Math.round(amount) - dpp, total: Math.round(amount) };
  }
  const dpp = Math.round(amount);
  const ppn = Math.round(amount * rate);
  return { dpp, ppn, total: dpp + ppn };
}

/** Compute PPh withheld on a base amount. */
export function computePph(base: number, rate: number): PphResult {
  const pph = Math.round(base * rate);
  return { pph, net: Math.round(base) - pph };
}
