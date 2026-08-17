/**
 * Pure audio helpers for the neural (downloadable) text-to-speech path: encode
 * Float32 PCM to a WAV file, concatenate speech segments with silence (for
 * pauses), and split input text on pause markers. MP3 encoding and the neural
 * synthesis live in the engine/island. No I/O here.
 */

/** Encode mono Float32 samples (−1..1) as a 16-bit PCM WAV file. */
export function floatToWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buffer);
}

/** Float32 samples → Int16 PCM (for MP3 encoding). */
export function floatToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Join audio segments with `silenceSamples` of silence between each (no trailing). */
export function concatWithSilence(segments: Float32Array[], silenceSamples: number): Float32Array {
  if (segments.length === 0) return new Float32Array(0);
  const gaps = Math.max(0, segments.length - 1) * Math.max(0, silenceSamples);
  const total = segments.reduce((n, s) => n + s.length, 0) + gaps;
  const out = new Float32Array(total);
  let off = 0;
  segments.forEach((seg, i) => {
    out.set(seg, off);
    off += seg.length;
    if (i < segments.length - 1) off += Math.max(0, silenceSamples);
  });
  return out;
}

/** Split text into speech segments on `[pause]` markers and blank lines. */
export function splitForPause(text: string): string[] {
  return text
    .split(/\[pause\]|\n\s*\n/gi)
    .map((s) => s.trim())
    .filter(Boolean);
}
