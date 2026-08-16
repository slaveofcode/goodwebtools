/**
 * Pure Pomodoro sequencing and clock formatting. The ticking itself lives in the
 * island (it needs real time); everything decidable without a clock is here and
 * unit-tested.
 */

export type Phase = 'work' | 'short' | 'long';

export interface PomodoroConfig {
  workMin: number;
  shortMin: number;
  longMin: number;
  /** Work sessions between long breaks. */
  rounds: number;
}

/** Duration of a phase in seconds for the given config. */
export function phaseDuration(phase: Phase, cfg: PomodoroConfig): number {
  const min = phase === 'work' ? cfg.workMin : phase === 'short' ? cfg.shortMin : cfg.longMin;
  return Math.max(0, Math.round(min * 60));
}

/**
 * Given the phase that just finished and how many work sessions were completed
 * before it, return the next phase and the updated completed-work count.
 */
export function nextPhase(phase: Phase, completedWork: number, cfg: PomodoroConfig): { phase: Phase; completedWork: number } {
  if (phase === 'work') {
    const done = completedWork + 1;
    const takeLong = cfg.rounds > 0 && done % cfg.rounds === 0;
    return { phase: takeLong ? 'long' : 'short', completedWork: done };
  }
  return { phase: 'work', completedWork };
}

/** Seconds → `MM:SS`, or `H:MM:SS` once there is at least an hour. Negatives clamp to 0. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}
