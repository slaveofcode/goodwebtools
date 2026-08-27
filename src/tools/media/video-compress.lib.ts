/**
 * Pure bitrate planning for "compress a video to a target file size".
 *
 * The size of an encoded video is (bitrate × duration), so to hit a target file
 * size we solve for the bitrate budget and split it between video and audio.
 * All browser/ffmpeg work lives in the island; this module is pure math so it
 * can be unit-tested without a real encoder.
 */

/** Below this, x264 output looks unusable — we clamp here and warn instead. */
export const MIN_VIDEO_KBPS = 100;

export interface SizePreset {
  label: string;
  bytes: number;
}

/** Common upload limits people compress for (WhatsApp/Discord/email). */
export const VIDEO_TARGET_PRESETS: SizePreset[] = [
  { label: '8 MB', bytes: 8 * 1024 * 1024 },
  { label: '16 MB (WhatsApp)', bytes: 16 * 1024 * 1024 },
  { label: '25 MB (Discord / email)', bytes: 25 * 1024 * 1024 },
  { label: '50 MB', bytes: 50 * 1024 * 1024 },
  { label: '100 MB', bytes: 100 * 1024 * 1024 },
];

export interface BitrateInput {
  /** Desired output size in bytes. */
  targetBytes: number;
  /** Clip duration in seconds (after any trim). */
  durationSec: number;
  /** Requested audio bitrate in kbps; 0 drops audio entirely. */
  audioKbps: number;
  /** Fraction of the raw budget to actually target (container/muxing headroom). Default 0.95. */
  overhead?: number;
}

export interface BitratePlan {
  videoKbps: number;
  audioKbps: number;
  /** Predicted output size in bytes for the chosen bitrates. */
  estimatedBytes: number;
  /** True when even the minimum video bitrate (audio dropped) exceeds the target. */
  overBudget: boolean;
}

/** Predicted encoded size for a given video+audio bitrate over a duration. */
export function estimateBytes(videoKbps: number, audioKbps: number, durationSec: number): number {
  return Math.round(((videoKbps + audioKbps) * 1000 * durationSec) / 8);
}

/**
 * Plan the video/audio bitrates that land closest to (and under) `targetBytes`.
 * If the requested audio bitrate leaves too little for video, the audio is
 * stepped down a ladder (96 → 64 → 48 → 32 → drop) before the video is clamped.
 */
export function computeTargetBitrate(input: BitrateInput): BitratePlan {
  const overhead = input.overhead ?? 0.95;
  if (!(input.durationSec > 0)) throw new Error('durationSec must be > 0');
  if (!(input.targetBytes > 0)) throw new Error('targetBytes must be > 0');

  const budgetKbps = ((input.targetBytes * 8) / 1000 / input.durationSec) * overhead;

  const ladder = [96, 64, 48, 32].filter(v => v < input.audioKbps);
  const audioOptions = input.audioKbps > 0 ? [input.audioKbps, ...ladder, 0] : [0];

  for (const a of audioOptions) {
    const v = budgetKbps - a;
    if (v >= MIN_VIDEO_KBPS) {
      const videoKbps = Math.floor(v);
      return {
        videoKbps,
        audioKbps: a,
        estimatedBytes: estimateBytes(videoKbps, a, input.durationSec),
        overBudget: false,
      };
    }
  }

  // Even with audio dropped we can't fit — clamp to the floor and flag it.
  return {
    videoKbps: MIN_VIDEO_KBPS,
    audioKbps: 0,
    estimatedBytes: estimateBytes(MIN_VIDEO_KBPS, 0, input.durationSec),
    overBudget: true,
  };
}
