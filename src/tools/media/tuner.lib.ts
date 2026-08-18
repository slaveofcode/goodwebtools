/**
 * Instrument-tuner DSP: pitch detection via autocorrelation, and mapping a
 * frequency to the nearest musical note + cents offset. Pure and framework-free;
 * the island feeds time-domain samples from an AnalyserNode.
 */

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export interface NoteReading {
  freq: number;
  note: string;      // e.g. 'A'
  octave: number;    // e.g. 4
  cents: number;     // -50..+50, how far from in-tune
  targetFreq: number;
  inTune: boolean;   // within ±5 cents
}

/**
 * Detect the fundamental frequency of a time-domain buffer via autocorrelation.
 * Returns -1 when the signal is too quiet or no clear pitch is found.
 */
export function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  // RMS gate — ignore near-silence.
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  // Trim leading/trailing samples below a threshold to sharpen the correlation.
  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  const b = buf.slice(r1, r2);
  const n = b.length;

  const c = new Float32Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) c[i] += b[j] * b[j + i];

  // First dip, then the highest peak after it = the fundamental period.
  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let period = maxpos;
  if (period <= 0) return -1;

  // Parabolic interpolation around the peak for sub-sample accuracy.
  const x1 = c[period - 1] ?? c[period];
  const x2 = c[period];
  const x3 = c[period + 1] ?? c[period];
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a) period -= bb / (2 * a);

  return sampleRate / period;
}

/** Map a frequency to the nearest note, octave and cents offset. */
export function freqToNote(freq: number): NoteReading {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const nearest = Math.round(midi);
  const targetFreq = 440 * Math.pow(2, (nearest - 69) / 12);
  const cents = Math.round(1200 * Math.log2(freq / targetFreq));
  return {
    freq,
    note: NOTE_NAMES[((nearest % 12) + 12) % 12],
    octave: Math.floor(nearest / 12) - 1,
    cents,
    targetFreq,
    inTune: Math.abs(cents) <= 5,
  };
}

/** Standard-tuning open-string reference frequencies (guitar). */
export const GUITAR_STRINGS = [
  { note: 'E2', freq: 82.41 }, { note: 'A2', freq: 110.0 }, { note: 'D3', freq: 146.83 },
  { note: 'G3', freq: 196.0 }, { note: 'B3', freq: 246.94 }, { note: 'E4', freq: 329.63 },
];
