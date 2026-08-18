/**
 * Test-tone definitions for the speaker / headphone test. Pure and
 * framework-free; the island creates the actual Web Audio oscillator + stereo
 * panner from these values.
 */

export type Channel = 'left' | 'right' | 'both';

export interface TestTone {
  key: string;
  label: string;
  hz: number;
}

/** A handful of reference tones covering low, mid and high frequencies. */
export const TEST_TONES: TestTone[] = [
  { key: 'sub', label: 'Sub bass — 60 Hz', hz: 60 },
  { key: 'bass', label: 'Bass — 120 Hz', hz: 120 },
  { key: 'mid', label: 'Midrange — 440 Hz (A4)', hz: 440 },
  { key: 'high', label: 'Treble — 2 kHz', hz: 2000 },
  { key: 'veryhigh', label: 'High treble — 8 kHz', hz: 8000 },
  { key: 'top', label: 'Top end — 14 kHz', hz: 14000 },
];

/** A stereo pan value in [-1, 1] for a given channel. */
export function panFor(channel: Channel): number {
  return channel === 'left' ? -1 : channel === 'right' ? 1 : 0;
}

/**
 * Log-spaced frequency steps for a rising sweep, from `from` Hz to `to` Hz.
 * Log spacing matches how we hear pitch, so the sweep sounds even.
 */
export function sweepFrequencies(steps: number, from = 20, to = 20000): number[] {
  if (steps < 2) return [from];
  const out: number[] = [];
  const ratio = Math.log(to / from);
  for (let i = 0; i < steps; i++) {
    out.push(Math.round(from * Math.exp((ratio * i) / (steps - 1))));
  }
  return out;
}
