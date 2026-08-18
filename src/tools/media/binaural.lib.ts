/**
 * Binaural / isochronic tone maths for the ambient generator. Pure and
 * framework-free; the island builds the oscillator/merger graph from these.
 */

export interface Band {
  key: string;
  label: string;
  beat: number;     // default beat/pulse frequency (Hz)
  carrier: number;  // default carrier frequency (Hz)
  note: string;
}

/**
 * Descriptive frequency bands. Deliberately framed as frequency ranges, not
 * health outcomes — the evidence for binaural-beat effects is thin and mixed.
 */
export const BANDS: Band[] = [
  { key: 'delta', label: 'Delta', beat: 2, carrier: 120, note: '0.5–4 Hz · deep/slow' },
  { key: 'theta', label: 'Theta', beat: 6, carrier: 150, note: '4–8 Hz · drowsy/meditative' },
  { key: 'alpha', label: 'Alpha', beat: 10, carrier: 200, note: '8–13 Hz · relaxed/calm' },
  { key: 'beta', label: 'Beta', beat: 18, carrier: 250, note: '13–30 Hz · alert' },
  { key: 'gamma', label: 'Gamma', beat: 40, carrier: 300, note: '30–50 Hz · fast' },
];

export const CARRIER_MIN = 50;
export const CARRIER_MAX = 500;
export const BEAT_MIN = 0.5;
export const BEAT_MAX = 50;

/** Left/right oscillator frequencies for a carrier + beat (binaural). */
export function binauralFreqs(carrier: number, beat: number): [number, number] {
  return [carrier - beat / 2, carrier + beat / 2];
}

export const clampCarrier = (hz: number): number => Math.min(CARRIER_MAX, Math.max(CARRIER_MIN, hz));
export const clampBeat = (hz: number): number => Math.min(BEAT_MAX, Math.max(BEAT_MIN, hz));

/** Look up a band by key (defaults to alpha). */
export function bandByKey(key: string): Band {
  return BANDS.find((b) => b.key === key) ?? BANDS[2];
}
