/**
 * Pure helpers for the webcam Video Recorder. Framework- and DOM-light so they
 * unit-test cleanly; the island owns the MediaStream / MediaRecorder lifecycle.
 */

export interface RecordingType {
  mime: string;
  ext: string;
}

// Ordered best-first. WebM (VP9/VP8) is what MediaRecorder supports widely;
// mp4 is a fallback for the (few) engines that record it.
const CANDIDATES: RecordingType[] = [
  { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
  { mime: 'video/mp4', ext: 'mp4' },
];

/** The best recording container/codec the current browser supports. */
export function pickRecordingType(): RecordingType {
  const MR = typeof MediaRecorder !== 'undefined' ? MediaRecorder : undefined;
  for (const c of CANDIDATES) {
    if (MR && MR.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', ext: 'webm' }; // let the browser choose its default container
}

/** Elapsed milliseconds → `M:SS` (or `H:MM:SS`). */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  const s = total % 60, m = Math.floor(total / 60) % 60, h = Math.floor(total / 3600);
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

export type Resolution = '480p' | '720p' | '1080p';

/** Ideal capture width/height for a resolution preset. */
export function resolutionConstraint(res: Resolution): { width: number; height: number } {
  switch (res) {
    case '480p': return { width: 854, height: 480 };
    case '1080p': return { width: 1920, height: 1080 };
    case '720p':
    default: return { width: 1280, height: 720 };
  }
}
