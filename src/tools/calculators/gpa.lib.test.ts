import { describe, it, expect } from 'vitest';
import { gradeToPoints, computeGpa } from './gpa.lib';

describe('gradeToPoints', () => {
  it.each([
    ['A', 4.0], ['a', 4.0], ['A-', 3.7], ['B+', 3.3], ['F', 0.0],
  ])('%s → %d', (g, p) => {
    expect(gradeToPoints(g)).toBe(p);
  });
  it('returns null for unknown grades', () => {
    expect(gradeToPoints('Z')).toBeNull();
  });
});

describe('computeGpa', () => {
  it('credit-weights the grade points', () => {
    // A(3cr)=12, B(4cr)=12 → 24/7 = 3.4286
    const r = computeGpa([{ grade: 'A', credits: 3 }, { grade: 'B', credits: 4 }]);
    expect(r.credits).toBe(7);
    expect(r.gpa).toBeCloseTo(3.4286, 3);
  });
  it('ignores unknown grades and zero-credit rows', () => {
    const r = computeGpa([{ grade: 'A', credits: 3 }, { grade: 'Z', credits: 3 }, { grade: 'B', credits: 0 }]);
    expect(r.credits).toBe(3);
    expect(r.gpa).toBe(4.0);
  });
  it('is 0 when no valid rows', () => {
    expect(computeGpa([]).gpa).toBe(0);
  });
});
