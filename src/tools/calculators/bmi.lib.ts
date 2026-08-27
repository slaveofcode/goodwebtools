/** Pure Body Mass Index math. Unit conversions live in the island. */

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

/** BMI from weight (kg) and height (cm). Returns 0 for non-positive height. */
export function computeBmi(kg: number, cm: number): number {
  const m = cm / 100;
  return m > 0 ? kg / (m * m) : 0;
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/** The healthy weight range (kg) for a given height, using BMI 18.5–24.9. */
export function healthyWeightRange(cm: number): { min: number; max: number } {
  const m = cm / 100;
  return { min: 18.5 * m * m, max: 24.9 * m * m };
}

/** Pounds → kilograms. */
export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

/** Feet + inches → centimetres. */
export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * 2.54;
}
