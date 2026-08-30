/**
 * Pure helpers for Daily Word Guess: guess evaluation with correct
 * duplicate-letter handling, the deterministic daily answer, stats, the
 * spoiler-free share text, and keyboard state derivation. All UI (tiles,
 * keyboard, animations) lives in the island.
 */

export type LetterState = 'correct' | 'present' | 'absent';

export interface Stats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  distribution: number[]; // length 6, tries 1–6
}

/** Milliseconds in a UTC day. */
const DAY_MS = 86_400_000;
/** Fixed epoch for puzzle numbering: 2026-01-01T00:00:00Z → puzzle #1. */
const PUZZLE_EPOCH_DAYS = Math.floor(Date.UTC(2026, 0, 1) / DAY_MS);

/**
 * Evaluate a 5-letter guess against the answer. Greens are marked first; then
 * yellows consume the answer's remaining letter counts, so duplicates can
 * never over-report. Caller guarantees both are 5 lowercase letters.
 */
export function evaluateGuess(guess: string, answer: string): LetterState[] {
  const states: LetterState[] = ['absent', 'absent', 'absent', 'absent', 'absent'];
  const remaining = new Map<string, number>();
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) states[i] = 'correct';
    else remaining.set(answer[i], (remaining.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < 5; i++) {
    if (states[i] !== 'absent') continue;
    const left = remaining.get(guess[i]) ?? 0;
    if (left > 0) {
      states[i] = 'present';
      remaining.set(guess[i], left - 1);
    }
  }
  return states;
}

/** Whole UTC days since the Unix epoch for the given instant. */
export function dayIndex(date: Date = new Date()): number {
  return Math.floor(date.getTime() / DAY_MS);
}

/** Human-facing puzzle number: 1 on 2026-01-01, counting up daily. */
export function puzzleNumber(day: number): number {
  return day - PUZZLE_EPOCH_DAYS + 1;
}

/** Small fast seeded PRNG (mulberry32) — enough entropy for word selection. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The deterministic daily answer for a day index, within the given list. */
export function dailyAnswer(day: number, answers: readonly string[]): string {
  const rand = mulberry32(day * 2654435761);
  return answers[Math.floor(rand() * answers.length)];
}

/** A random practice answer (never the daily one, when avoid is given). */
export function practiceAnswer(answers: readonly string[], avoid?: string): string {
  let word = answers[Math.floor(Math.random() * answers.length)];
  if (answers.length > 1) {
    let guard = 0;
    while (word === avoid && guard++ < 10) {
      word = answers[Math.floor(Math.random() * answers.length)];
    }
  }
  return word;
}

/** Fold a finished daily into the running stats. `tries` is 1–6. */
export function updateStats(stats: Stats, won: boolean, tries: number): Stats {
  if (tries < 1 || tries > 6) throw new Error(`tries out of range: ${tries}`);
  const distribution = [...stats.distribution];
  if (won) distribution[tries - 1] += 1;
  const streak = won ? stats.streak + 1 : 0;
  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    distribution,
  };
}

const SHARE_EMOJI: Record<LetterState, string> = {
  correct: '🟩',
  present: '🟨',
  absent: '⬛',
};

/** Spoiler-free share text: header line + one emoji row per guess. */
export function buildShareText(
  rows: LetterState[][],
  won: boolean,
  tries: number,
  puzzle: number,
): string {
  const header = `GoodWebTools Word Guess #${puzzle} ${won ? `${tries}/6` : 'X/6'}`;
  const grid = rows.map(row => row.map(s => SHARE_EMOJI[s]).join('')).join('\n');
  return `${header}\n${grid}`;
}

const PRIORITY: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };

/** Best-known state per letter across all guesses (for keyboard coloring). */
export function keyboardStates(guesses: string[], answer: string): Record<string, LetterState> {
  const best: Record<string, LetterState> = {};
  for (const guess of guesses) {
    const states = evaluateGuess(guess, answer);
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const prev = best[letter];
      if (!prev || PRIORITY[states[i]] > PRIORITY[prev]) best[letter] = states[i];
    }
  }
  return best;
}
