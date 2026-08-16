import { describe, it, expect } from 'vitest';
import { calcThr } from './thr.lib';

describe('calcThr', () => {
  it('pays a full month once 12 months are worked', () => {
    const r = calcThr(5_000_000, 12);
    expect(r.entitled).toBe(true);
    expect(r.proportional).toBe(false);
    expect(r.amount).toBeCloseTo(5_000_000, 6);
  });

  it('caps at one month for longer tenure', () => {
    expect(calcThr(5_000_000, 30).amount).toBeCloseTo(5_000_000, 6);
  });

  it('is proportional below 12 months', () => {
    const r = calcThr(6_000_000, 6);
    expect(r.entitled).toBe(true);
    expect(r.proportional).toBe(true);
    expect(r.amount).toBeCloseTo(3_000_000, 6); // 6/12 × 6,000,000
  });

  it('is not entitled below one month of service', () => {
    const r = calcThr(5_000_000, 0.5);
    expect(r.entitled).toBe(false);
    expect(r.amount).toBe(0);
  });
});
