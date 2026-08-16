/**
 * Pure THR (Tunjangan Hari Raya) calculation per Indonesian rules: one month's
 * pay at 12+ months of service, prorated (monthsWorked/12) from 1 to 12 months,
 * and nothing below one month. No I/O.
 */

export interface ThrResult {
  entitled: boolean;
  proportional: boolean;
  amount: number;
}

export function calcThr(monthlySalary: number, monthsWorked: number): ThrResult {
  const salary = monthlySalary > 0 ? monthlySalary : 0;
  const months = monthsWorked > 0 ? monthsWorked : 0;
  if (months < 1) return { entitled: false, proportional: false, amount: 0 };
  if (months >= 12) return { entitled: true, proportional: false, amount: salary };
  return { entitled: true, proportional: true, amount: (months / 12) * salary };
}
