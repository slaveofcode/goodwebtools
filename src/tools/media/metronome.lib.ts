/**
 * Metronome timing maths. Pure and framework-free; the island runs the
 * two-clock Web Audio scheduler and schedules a click at each returned time.
 */

export const BPM_MIN = 20;
export const BPM_MAX = 300;

/** Seconds between beats for a tempo. */
export function beatInterval(bpm: number): number {
  return 60 / clampBpm(bpm);
}

export const clampBpm = (bpm: number): number => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));

/** Whether a beat index is the accented downbeat of its bar. */
export function isDownbeat(beatIndex: number, beatsPerBar: number): boolean {
  if (beatsPerBar <= 0) return true;
  return beatIndex % beatsPerBar === 0;
}

/**
 * Estimate a tempo from tap timestamps (ms). Uses the average gap of the most
 * recent taps; returns null with fewer than two taps.
 */
export function tapTempo(timestampsMs: number[]): number | null {
  if (timestampsMs.length < 2) return null;
  const recent = timestampsMs.slice(-6);
  let sum = 0;
  for (let i = 1; i < recent.length; i++) sum += recent[i] - recent[i - 1];
  const avgMs = sum / (recent.length - 1);
  if (avgMs <= 0) return null;
  return clampBpm(60000 / avgMs);
}

export const TIME_SIGNATURES = [1, 2, 3, 4, 5, 6, 7] as const;
