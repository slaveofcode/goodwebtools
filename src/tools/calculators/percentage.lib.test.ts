import { describe, it, expect } from 'vitest';
import { percentOf, whatPercent, percentChange, tip, discount } from './percentage.lib';

describe('percentage', () => {
  it('percentOf', () => {
    expect(percentOf(15, 340000)).toBe(51000);
    expect(percentOf(0, 100)).toBe(0);
  });

  it('whatPercent', () => {
    expect(whatPercent(50, 200)).toBe(25);
    expect(whatPercent(5, 0)).toBe(0);
  });

  it('percentChange', () => {
    expect(percentChange(100, 150)).toBe(50);
    expect(percentChange(200, 100)).toBe(-50);
    expect(percentChange(0, 100)).toBe(0);
  });

  it('tip splits across people', () => {
    const r = tip(100, 10, 2);
    expect(r.tip).toBe(10);
    expect(r.total).toBe(110);
    expect(r.perPerson).toBe(55);
  });

  it('tip guards against zero people', () => {
    expect(tip(100, 10, 0).perPerson).toBe(110);
  });

  it('discount', () => {
    const r = discount(340000, 15);
    expect(r.saved).toBe(51000);
    expect(r.final).toBe(289000);
  });
});
