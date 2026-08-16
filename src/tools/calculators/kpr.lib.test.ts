import { describe, it, expect } from 'vitest';
import { monthlyPayment, loanSummary, buildSchedule } from './kpr.lib';

describe('monthlyPayment', () => {
  it('computes an annuity payment', () => {
    // 100,000,000 at 12%/yr over 12 months → ~8,884,879
    expect(monthlyPayment(100_000_000, 12, 12)).toBeCloseTo(8_884_878.7, 0);
  });
  it('handles a zero interest rate as straight division', () => {
    expect(monthlyPayment(1_200_000, 0, 12)).toBeCloseTo(100_000, 6);
  });
  it('is zero for a zero principal or zero months', () => {
    expect(monthlyPayment(0, 10, 12)).toBe(0);
    expect(monthlyPayment(1000, 10, 0)).toBe(0);
  });
});

describe('loanSummary', () => {
  it('reports monthly, total payment and total interest', () => {
    const s = loanSummary(1_200_000, 0, 12);
    expect(s.monthly).toBeCloseTo(100_000, 6);
    expect(s.totalPayment).toBeCloseTo(1_200_000, 6);
    expect(s.totalInterest).toBeCloseTo(0, 6);
  });
  it('total interest is total payment minus principal', () => {
    const s = loanSummary(100_000_000, 12, 12);
    expect(s.totalInterest).toBeCloseTo(s.totalPayment - 100_000_000, 2);
  });
});

describe('buildSchedule', () => {
  it('amortises to a (near) zero balance', () => {
    const rows = buildSchedule(100_000_000, 12, 12);
    expect(rows).toHaveLength(12);
    expect(rows[11].balance).toBeCloseTo(0, 2);
    // First month interest = principal * monthly rate.
    expect(rows[0].interest).toBeCloseTo(1_000_000, 2);
  });
});
