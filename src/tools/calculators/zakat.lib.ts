/**
 * Pure zakat calculations. Zakat maal and zakat penghasilan (income) are both
 * 2.5% once wealth/income reaches the nisab, which is the value of 85 grams of
 * gold. No I/O.
 */

export const ZAKAT_RATE = 0.025;
export const NISAB_GOLD_GRAMS = 85;

/** Nisab value from a gold price per gram (85 g of gold). */
export function goldNisab(pricePerGram: number): number {
  return NISAB_GOLD_GRAMS * (pricePerGram > 0 ? pricePerGram : 0);
}

export interface MaalResult { net: number; due: boolean; amount: number; }

/** Zakat maal on net wealth (assets − liabilities) at 2.5% if at/above nisab. */
export function zakatMaal(assets: number, liabilities: number, nisab: number): MaalResult {
  const net = (assets || 0) - (liabilities || 0);
  const due = net > 0 && net >= nisab;
  return { net, due, amount: due ? net * ZAKAT_RATE : 0 };
}

export interface IncomeResult { annual: number; due: boolean; monthlyZakat: number; annualZakat: number; }

/** Zakat penghasilan on monthly net income; due when the annualised amount reaches nisab. */
export function zakatIncome(monthlyNet: number, nisab: number): IncomeResult {
  const monthly = monthlyNet || 0;
  const annual = monthly * 12;
  const due = annual > 0 && annual >= nisab;
  return {
    annual,
    due,
    monthlyZakat: due ? monthly * ZAKAT_RATE : 0,
    annualZakat: due ? annual * ZAKAT_RATE : 0,
  };
}
