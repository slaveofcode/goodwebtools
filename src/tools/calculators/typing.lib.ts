/**
 * Pure typing-test math: compare typed text against a target and derive
 * words-per-minute and accuracy. A "word" is the standard 5 characters.
 */

export interface TypingStats {
  wpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  totalTyped: number;
}

/** Character-by-character comparison; anything typed past the target counts as incorrect. */
export function compareChars(target: string, typed: string): { correct: number; incorrect: number } {
  let correct = 0;
  let incorrect = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i < target.length && typed[i] === target[i]) correct++;
    else incorrect++;
  }
  return { correct, incorrect };
}

function wpm(chars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.round((chars / 5) / (elapsedMs / 60000));
}

/** WPM counting only correctly typed characters. */
export function netWpm(correctChars: number, elapsedMs: number): number {
  return wpm(correctChars, elapsedMs);
}

/** WPM counting every typed character, right or wrong. */
export function grossWpm(totalTyped: number, elapsedMs: number): number {
  return wpm(totalTyped, elapsedMs);
}

/** Percentage of typed characters that were correct (100 when nothing typed). */
export function accuracy(correct: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((correct / total) * 100);
}

export function typingStats(target: string, typed: string, elapsedMs: number): TypingStats {
  const { correct, incorrect } = compareChars(target, typed);
  return {
    wpm: netWpm(correct, elapsedMs),
    accuracy: accuracy(correct, typed.length),
    correctChars: correct,
    incorrectChars: incorrect,
    totalTyped: typed.length,
  };
}
