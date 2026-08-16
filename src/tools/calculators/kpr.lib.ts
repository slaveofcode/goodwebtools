/**
 * Pure fixed-rate loan (KPR / cicilan) math — annuity monthly payment,
 * totals and an amortisation schedule. No I/O.
 */

export interface LoanSummary {
  monthly: number;
  totalPayment: number;
  totalInterest: number;
}

export interface ScheduleRow {
  month: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Annuity monthly payment for a principal at annualRatePct over `months`. */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  const factor = Math.pow(1 + r, months);
  return (principal * r * factor) / (factor - 1);
}

export function loanSummary(principal: number, annualRatePct: number, months: number): LoanSummary {
  const monthly = monthlyPayment(principal, annualRatePct, months);
  const totalPayment = monthly * Math.max(0, months);
  return {
    monthly,
    totalPayment,
    totalInterest: totalPayment - (principal > 0 ? principal : 0),
  };
}

/** Month-by-month amortisation. The final row's balance settles any rounding drift. */
export function buildSchedule(principal: number, annualRatePct: number, months: number): ScheduleRow[] {
  if (principal <= 0 || months <= 0) return [];
  const r = annualRatePct / 100 / 12;
  const monthly = monthlyPayment(principal, annualRatePct, months);
  const rows: ScheduleRow[] = [];
  let balance = principal;
  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    let principalPart = monthly - interest;
    if (m === months) principalPart = balance; // clear any residual
    balance = Math.max(0, balance - principalPart);
    rows.push({ month: m, interest, principal: principalPart, balance });
  }
  return rows;
}
