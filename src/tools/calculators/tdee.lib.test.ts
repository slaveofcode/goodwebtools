import { describe, it, expect } from 'vitest';
import { bmr, tdee, calorieGoals } from './tdee.lib';

describe('bmr', () => {
  it('male: 10w + 6.25h − 5a + 5', () => {
    // 80kg, 180cm, 30y → 800 + 1125 − 150 + 5 = 1780
    expect(bmr('male', 80, 180, 30)).toBe(1780);
  });
  it('female: same base − 161', () => {
    expect(bmr('female', 80, 180, 30)).toBe(1614);
  });
});

describe('tdee', () => {
  it('scales BMR by the activity factor', () => {
    expect(tdee('male', 80, 180, 30, 'moderate')).toBeCloseTo(2759, 0);
    expect(tdee('male', 80, 180, 30, 'sedentary')).toBeCloseTo(2136, 0);
  });
});

describe('calorieGoals', () => {
  it('offsets ±250/±500 around maintenance', () => {
    const g = calorieGoals(2000);
    expect(g).toEqual({ loseFast: 1500, lose: 1750, maintain: 2000, gain: 2250, gainFast: 2500 });
  });
});
