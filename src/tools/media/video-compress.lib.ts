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

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Output size for a compress job, in display orientation (a portrait phone clip
 * stored as 1920×1080 + 90° rotation comes out 720×1280, not sideways). When the
 * bitrate budget is too small for the source, the shorter side is capped — a
 * sharp 720p looks better than a blocky 1080p: under 1500 kbps → 720, under
 * 600 kbps → 480. `userMaxWidth` (> 0) then caps the displayed width. Never upscales.
 */
export function planResolution(
  src: { width: number; height: number; rotation: 0 | 90 | 180 | 270 },
  videoKbps: number,
  userMaxWidth: number,
): { width: number; height: number } {
  const sideways = src.rotation === 90 || src.rotation === 270;
  const w = sideways ? src.height : src.width;
  const h = sideways ? src.width : src.height;
  const cap = videoKbps < 600 ? 480 : videoKbps < 1500 ? 720 : Infinity;
  let scale = Math.min(1, cap / Math.min(w, h));
  if (userMaxWidth > 0) scale = Math.min(scale, userMaxWidth / w);
  return { width: even(w * scale), height: even(h * scale) };
}

/**
 * Hardware encoders hit a bitrate less exactly than x264. If the result is more
 * than 2% over the target, return a lower video bitrate for one retry (scaled by
 * the overshoot, with a 3% margin, never below MIN_VIDEO_KBPS); otherwise null.
 */
export function sizeRetryKbps(targetBytes: number, actualBytes: number, videoKbps: number): number | null {
  if (actualBytes <= targetBytes * 1.02) return null;
  return Math.max(MIN_VIDEO_KBPS, Math.floor(videoKbps * (targetBytes / actualBytes) * 0.97));
}
