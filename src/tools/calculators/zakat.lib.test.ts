import { describe, it, expect } from 'vitest';
import { goldNisab, zakatMaal, zakatIncome, ZAKAT_RATE } from './zakat.lib';

describe('goldNisab', () => {
  it('is 85 grams times the gold price', () => {
    expect(goldNisab(1_000_000)).toBe(85_000_000);
  });
});

describe('zakatMaal', () => {
  const nisab = 85_000_000;
  it('is 2.5% of net wealth when at or above nisab', () => {
    const r = zakatMaal(100_000_000, 0, nisab);
    expect(r.net).toBe(100_000_000);
    expect(r.due).toBe(true);
    expect(r.amount).toBeCloseTo(2_500_000, 6);
  });
  it('subtracts liabilities from assets', () => {
    const r = zakatMaal(120_000_000, 40_000_000, nisab);
    expect(r.net).toBe(80_000_000);
    expect(r.due).toBe(false);
    expect(r.amount).toBe(0);
  });
  it('is not due below nisab', () => {
    expect(zakatMaal(50_000_000, 0, nisab).due).toBe(false);
  });
  it('uses the standard 2.5% rate', () => {
    expect(ZAKAT_RATE).toBe(0.025);
  });
});

describe('zakatIncome', () => {
  const nisab = 85_000_000;
  it('is due when annualised income reaches nisab', () => {
    const r = zakatIncome(10_000_000, nisab);
    expect(r.annual).toBe(120_000_000);
    expect(r.due).toBe(true);
    expect(r.monthlyZakat).toBeCloseTo(250_000, 6);
    expect(r.annualZakat).toBeCloseTo(3_000_000, 6);
  });
  it('is not due when annual income is below nisab', () => {
    const r = zakatIncome(5_000_000, nisab);
    expect(r.due).toBe(false);
    expect(r.monthlyZakat).toBe(0);
  });
});
