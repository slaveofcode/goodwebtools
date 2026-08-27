/** Pure GPA math on a 4.0 scale. */

export interface Course {
  grade: string;
  credits: number;
}

/** Standard US letter-grade → grade-point mapping (4.0 scale). */
export const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, A: 4.0, 'A-': 3.7,
  'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7,
  'D+': 1.3, D: 1.0, 'D-': 0.7,
  F: 0.0,
};

/** Grade points for a letter grade, or null if unrecognized. */
export function gradeToPoints(grade: string): number | null {
  const key = grade.trim().toUpperCase();
  return key in GRADE_POINTS ? GRADE_POINTS[key] : null;
}

/**
 * Credit-weighted GPA. Rows with an unknown grade or non-positive credits are
 * ignored, so a partially-filled form still gives a sensible running GPA.
 */
export function computeGpa(courses: Course[]): { gpa: number; credits: number } {
  let points = 0;
  let credits = 0;
  for (const c of courses) {
    const p = gradeToPoints(c.grade);
    if (p === null || !(c.credits > 0)) continue;
    points += p * c.credits;
    credits += c.credits;
  }
  return { gpa: credits > 0 ? points / credits : 0, credits };
}
