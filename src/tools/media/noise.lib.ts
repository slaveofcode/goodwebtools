/**
 * Coloured-noise sample generation for the white-noise / rain and ambient tools.
 * Pure and framework-free — fills a Float32Array the island then wraps in an
 * AudioBuffer. An injectable RNG keeps the generators testable.
 */

export type NoiseType = 'white' | 'pink' | 'brown';

export const NOISE_TYPES: { key: NoiseType; label: string }[] = [
  { key: 'white', label: 'White' },
  { key: 'pink', label: 'Pink' },
  { key: 'brown', label: 'Brown' },
];

type Rng = () => number;

/** Fill with white noise (flat spectrum). */
export function fillWhite(out: Float32Array, rng: Rng = Math.random): void {
  for (let i = 0; i < out.length; i++) out[i] = rng() * 2 - 1;
}

/** Fill with brown noise (−6 dB/oct — a soft, low rumble). */
export function fillBrown(out: Float32Array, rng: Rng = Math.random): void {
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rng() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    out[i] = last * 3.5; // brown noise is quiet — compensate
  }
}

/** Fill with pink noise (−3 dB/oct) using Paul Kellet's economy filter. */
export function fillPink(out: Float32Array, rng: Rng = Math.random): void {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rng() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
}

/** Allocate and fill a noise buffer of `length` samples. */
export function makeNoise(length: number, type: NoiseType, rng: Rng = Math.random): Float32Array {
  const out = new Float32Array(length);
  if (type === 'white') fillWhite(out, rng);
  else if (type === 'pink') fillPink(out, rng);
  else fillBrown(out, rng);
  return out;
}

/** Mean absolute sample-to-sample difference — a proxy for "how bright" the noise is. */
export function meanAbsDelta(samples: Float32Array): number {
  if (samples.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < samples.length; i++) sum += Math.abs(samples[i] - samples[i - 1]);
  return sum / (samples.length - 1);
}
