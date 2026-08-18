/**
 * Everyday percentage / tip / discount maths. Pure and framework-free.
 * All functions return numbers; the island handles formatting and currency.
 */

/** X% of N. */
export function percentOf(percent: number, of: number): number {
  return (percent / 100) * of;
}

/** What percent is A of B (A is what % of B). */
export function whatPercent(a: number, b: number): number {
  if (b === 0) return 0;
  return (a / b) * 100;
}

/** Percentage change from `from` to `to` (positive = increase). */
export function percentChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / Math.abs(from)) * 100;
}

export interface TipResult {
  tip: number;
  total: number;
  perPerson: number;
}

/** Tip and split. `people` defaults to 1; guarded against 0/negative. */
export function tip(bill: number, tipPercent: number, people = 1): TipResult {
  const p = Math.max(1, Math.floor(people));
  const tipAmount = percentOf(tipPercent, bill);
  const total = bill + tipAmount;
  return { tip: tipAmount, total, perPerson: total / p };
}

export interface DiscountResult {
  saved: number;
  final: number;
}

/** Apply a percentage discount to a price. */
export function discount(price: number, percentOff: number): DiscountResult {
  const saved = percentOf(percentOff, price);
  return { saved, final: price - saved };
}
