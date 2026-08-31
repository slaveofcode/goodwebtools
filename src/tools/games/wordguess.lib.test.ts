import { describe, it, expect } from 'vitest';
import {
  evaluateGuess,
  dayIndex,
  puzzleNumber,
  dailyAnswer,
  updateStats,
  buildShareText,
  keyboardStates,
  type Stats,
  type LetterState,
} from './wordguess.lib';
import { EN_ANSWERS, ID_ANSWERS } from './wordguess.words';

describe('evaluateGuess', () => {
  it('marks all correct', () => {
    expect(evaluateGuess('crane', 'crane')).toEqual([
      'correct', 'correct', 'correct', 'correct', 'correct',
    ]);
  });

  it('marks present and absent', () => {
    // answer ADIEU, guess ADOBE: A ok, D ok, O absent, B absent, E present
    expect(evaluateGuess('adobe', 'adieu')).toEqual([
      'correct', 'correct', 'absent', 'absent', 'present',
    ]);
  });

  it('handles duplicate guess letters with fewer in answer', () => {
    // guess ROBOT (two O), answer ABOUT (one O): first O present, second absent; B present
    expect(evaluateGuess('robot', 'about')).toEqual([
      'absent', 'present', 'present', 'absent', 'correct',
    ]);
  });

  it('handles duplicate answer letters', () => {
    // answer SASSY, guess STARS: S green, A present, last S present
    expect(evaluateGuess('stars', 'sassy')).toEqual([
      'correct', 'absent', 'present', 'absent', 'present',
    ]);
  });

  it('green takes priority when counts compete', () => {
    // answer BALMY, guess MAMBO: M present, A correct, M absent (only one M left), B present, O absent
    expect(evaluateGuess('mambo', 'balmy')).toEqual([
      'present', 'correct', 'absent', 'present', 'absent',
    ]);
  });
});

describe('dayIndex / puzzleNumber', () => {
  it('dayIndex is stable across the UTC day', () => {
    const a = dayIndex(new Date(Date.UTC(2026, 7, 30, 0, 0, 0)));
    const b = dayIndex(new Date(Date.UTC(2026, 7, 30, 23, 59, 59)));
    expect(a).toBe(b);
  });

  it('dayIndex rolls over at UTC midnight', () => {
    const a = dayIndex(new Date(Date.UTC(2026, 7, 30, 23, 59, 59)));
    const b = dayIndex(new Date(Date.UTC(2026, 7, 31, 0, 0, 0)));
    expect(b).toBe(a + 1);
  });

  it('puzzleNumber counts from the 2026-01-01 epoch (#1)', () => {
    const epoch = dayIndex(new Date(Date.UTC(2026, 0, 1)));
    expect(puzzleNumber(epoch)).toBe(1);
    expect(puzzleNumber(epoch + 1)).toBe(2);
    const before = dayIndex(new Date(Date.UTC(2025, 11, 31)));
    expect(puzzleNumber(before)).toBe(0);
  });
});

describe('dailyAnswer', () => {
  it('is deterministic for a given day and list', () => {
    const a = dailyAnswer(19000, EN_ANSWERS);
    const b = dailyAnswer(19000, EN_ANSWERS);
    expect(a).toBe(b);
    expect(EN_ANSWERS).toContain(a);
  });

  it('changes across days (at least once in a week)', () => {
    const words = new Set([0, 1, 2, 3, 4, 5, 6].map(d => dailyAnswer(20000 + d, EN_ANSWERS)));
    expect(words.size).toBeGreaterThan(1);
  });

  it('uses the list it is given (ID answers differ from EN)', () => {
    const en = dailyAnswer(19000, EN_ANSWERS);
    const id = dailyAnswer(19000, ID_ANSWERS);
    expect(ID_ANSWERS).toContain(id);
    expect(id === en).toBe(false);
  });
});

describe('updateStats', () => {
  const base: Stats = { played: 0, wins: 0, streak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0, 0] };

  it('records a win and builds the streak', () => {
    const s1 = updateStats(base, true, 3);
    expect(s1).toEqual({ played: 1, wins: 1, streak: 1, maxStreak: 1, distribution: [0, 0, 1, 0, 0, 0] });
    const s2 = updateStats(s1, true, 4);
    expect(s2.streak).toBe(2);
    expect(s2.maxStreak).toBe(2);
    expect(s2.distribution[3]).toBe(1);
  });

  it('a loss zeroes the streak and does not touch distribution', () => {
    const s1 = updateStats(base, true, 2);
    const s2 = updateStats(s1, false, 6);
    expect(s2).toEqual({ played: 2, wins: 1, streak: 0, maxStreak: 1, distribution: [0, 1, 0, 0, 0, 0] });
  });

  it('maxStreak survives a streak reset', () => {
    let s = base;
    for (let i = 0; i < 3; i++) s = updateStats(s, true, 1);
    s = updateStats(s, false, 6);
    s = updateStats(s, true, 1);
    expect(s.streak).toBe(1);
    expect(s.maxStreak).toBe(3);
  });

  it('rejects out-of-range tries', () => {
    expect(() => updateStats(base, true, 0)).toThrow();
    expect(() => updateStats(base, true, 7)).toThrow();
  });
});

describe('buildShareText', () => {
  it('renders the emoji grid without leaking letters', () => {
    const rows: LetterState[][] = [
      ['absent', 'present', 'absent', 'absent', 'absent'],
      ['correct', 'correct', 'correct', 'correct', 'correct'],
    ];
    const text = buildShareText(rows, true, 2, 42);
    const lines = text.trim().split('\n');
    expect(lines[0]).toContain('#42');
    expect(lines[0]).toContain('2/6');
    expect(lines[1]).toBe('⬛🟨⬛⬛⬛');
    expect(lines[2]).toBe('🟩🟩🟩🟩🟩');
    // only the header may contain letters; the grid rows are pure emoji
    expect(lines.slice(1).join('\n')).not.toMatch(/[a-z]/i);
  });

  it('renders a loss as X/6', () => {
    const rows: LetterState[][] = Array.from({ length: 6 }, () =>
      Array.from({ length: 5 }, () => 'absent' as LetterState,
    ));
    const text = buildShareText(rows, false, 6, 7);
    expect(text).toContain('X/6');
  });
});

describe('keyboardStates', () => {
  it('prioritizes correct > present > absent', () => {
    // guess STEAK, answer STAKE: S,T,A green; E,K present
    const ks = keyboardStates(['steak'], 'stake');
    expect(ks.s).toBe('correct');
    expect(ks.e).toBe('present');
    expect(ks.k).toBe('present');
    expect(ks.z).toBeUndefined();
  });

  it('a later correct upgrades an earlier present', () => {
    // E is present in ADOBE, then correct in ADIEU — must end correct, not downgraded
    const ks = keyboardStates(['adobe', 'adieu'], 'adieu');
    expect(ks.a).toBe('correct');
    expect(ks.e).toBe('correct');
    expect(ks.b).toBe('absent');
  });
});
