/** Pure BMR/TDEE math using the Mifflin-St Jeor equation. */

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

/** Basal Metabolic Rate (kcal/day), Mifflin-St Jeor. */
export function bmr(sex: Sex, kg: number, cm: number, age: number): number {
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Total Daily Energy Expenditure (kcal/day) = BMR × activity factor. */
export function tdee(sex: Sex, kg: number, cm: number, age: number, activity: Activity): number {
  return bmr(sex, kg, cm, age) * ACTIVITY_FACTORS[activity];
}

/** Calorie targets around maintenance for common goals. */
export function calorieGoals(tdeeValue: number): {
  loseFast: number; lose: number; maintain: number; gain: number; gainFast: number;
} {
  return {
    loseFast: tdeeValue - 500,
    lose: tdeeValue - 250,
    maintain: tdeeValue,
    gain: tdeeValue + 250,
    gainFast: tdeeValue + 500,
  };
}
