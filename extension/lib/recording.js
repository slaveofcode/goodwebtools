// Pure helpers for tab/screen recording (unit-tested outside Chrome).

/** Largest recording we hand straight to a site tool; bigger ones are downloaded. */
export const MAX_HANDOFF_BYTES = 50 * 1024 * 1024;

const CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

/** Best WebM type the browser's MediaRecorder supports ('' = let it choose). */
export function pickMimeType(isSupported) {
  return CANDIDATES.find((t) => { try { return isSupported(t); } catch { return false; } }) || '';
}

/** 65000 → "1:05", 3723000 → "1:02:03". */
export function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** gwt-recording-2026-11-05-1430.webm (local time). */
export function recordingFileName(date = new Date(), ext = 'webm') {
  const p = (n) => String(n).padStart(2, '0');
  return `gwt-recording-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.${ext}`;
}

export function canHandOff(bytes) {
  return bytes > 0 && bytes <= MAX_HANDOFF_BYTES;
}

/** Human-readable size: 1536 → "1.5 KB". */
export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
