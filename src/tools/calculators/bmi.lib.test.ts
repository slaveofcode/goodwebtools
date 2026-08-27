import { describe, it, expect } from 'vitest';
import { computeBmi, bmiCategory, healthyWeightRange, lbToKg, ftInToCm } from './bmi.lib';

describe('computeBmi', () => {
  it('computes kg/m²', () => {
    expect(computeBmi(70, 175)).toBeCloseTo(22.857, 2);
  });
  it('returns 0 for non-positive height', () => {
    expect(computeBmi(70, 0)).toBe(0);
  });
});

describe('bmiCategory', () => {
  it.each([
    [17, 'underweight'],
    [22, 'normal'],
    [27, 'overweight'],
    [33, 'obese'],
    [18.5, 'normal'],
    [25, 'overweight'],
  ])('classifies %d as %s', (bmi, cat) => {
    expect(bmiCategory(bmi)).toBe(cat);
  });
});

describe('healthyWeightRange', () => {
  it('spans BMI 18.5–24.9 for the height', () => {
    const r = healthyWeightRange(175);
    expect(r.min).toBeCloseTo(56.66, 1);
    expect(r.max).toBeCloseTo(76.26, 1);
  });
});

describe('unit conversions', () => {
  it('converts pounds to kg', () => {
    expect(lbToKg(154)).toBeCloseTo(69.85, 1);
  });
  it('converts feet+inches to cm', () => {
    expect(ftInToCm(5, 9)).toBeCloseTo(175.26, 1);
  });
});
