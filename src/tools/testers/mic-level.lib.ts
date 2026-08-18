/**
 * Microphone level metering maths. Pure and framework-free so it can be
 * unit-tested; the island wires up getUserMedia + an AnalyserNode and feeds the
 * time-domain samples here.
 */

/** Root-mean-square amplitude of time-domain samples in [-1, 1]. */
export function rms(samples: Float32Array | number[]): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Peak absolute amplitude of time-domain samples. */
export function peak(samples: Float32Array | number[]): number {
  let p = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > p) p = a;
  }
  return p;
}

/** Convert a linear amplitude (0–1) to decibels full scale (dBFS, ≤ 0). */
export function dbfs(amplitude: number): number {
  if (amplitude <= 0) return -Infinity;
  return 20 * Math.log10(amplitude);
}

/**
 * Map an RMS amplitude to a 0–100 meter reading. The audible range is mapped
 * from a -60 dBFS noise floor up to 0 dBFS so quiet speech still moves the bar.
 */
export function toMeter(amplitude: number, floorDb = -60): number {
  const db = dbfs(amplitude);
  if (!isFinite(db)) return 0;
  const clamped = Math.max(floorDb, Math.min(0, db));
  return Math.round(((clamped - floorDb) / -floorDb) * 100);
}
