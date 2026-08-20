/**
 * Shared local-media player logic: playlist ordering, track naming, time
 * formatting, A–B loop clamping and per-file resume positions. Pure and
 * framework-free — the islands own the <audio>/<video> elements.
 */

export interface Track {
  id: string;
  name: string;
  /** Bytes — used for the resume key and the file list. */
  size: number;
  type: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

/** Extensions browsers can usually decode natively. */
const PLAYABLE_AUDIO = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'weba', 'webm'];
const PLAYABLE_VIDEO = ['mp4', 'm4v', 'webm', 'ogv', 'mov'];

export const extOf = (name: string): string => (name.split('.').pop() ?? '').toLowerCase();

/** Is this file a plausible audio/video file for the given player kind? */
export function isSupported(name: string, kind: 'audio' | 'video'): boolean {
  const list = kind === 'audio' ? PLAYABLE_AUDIO : PLAYABLE_VIDEO;
  return list.includes(extOf(name));
}

/** Drop the extension for a friendlier track title. */
export function displayName(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

/** Format seconds as m:ss (or h:mm:ss past an hour). NaN/∞ → "0:00". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/**
 * Index of the next track. Returns null when the playlist should stop.
 * 'one' repeats the current track; 'all' wraps; 'off' stops at the end.
 */
export function nextIndex(current: number, length: number, repeat: RepeatMode, shuffle: boolean, rng: () => number = Math.random): number | null {
  if (length === 0) return null;
  if (repeat === 'one') return current;
  if (shuffle) {
    if (length === 1) return repeat === 'all' ? 0 : null;
    let i = Math.floor(rng() * (length - 1));
    if (i >= current) i++; // never repeat the current track back-to-back
    return i;
  }
  const next = current + 1;
  if (next < length) return next;
  return repeat === 'all' ? 0 : null;
}

/** Index of the previous track (wraps). */
export function prevIndex(current: number, length: number): number {
  if (length === 0) return 0;
  return (current - 1 + length) % length;
}

export interface Loop { a: number | null; b: number | null }

/**
 * Where playback should jump to, given an A–B loop. Returns the seek target
 * or null when no jump is needed.
 */
export function loopSeek(time: number, loop: Loop): number | null {
  if (loop.a === null || loop.b === null) return null;
  if (loop.b <= loop.a) return null;
  if (time >= loop.b || time < loop.a) return loop.a;
  return null;
}

/** Stable key for remembering a file's playback position. */
export function resumeKey(track: Track): string {
  return `${track.name}:${track.size}`;
}

/** Should we offer to resume? Ignore the very start and the last few seconds. */
export function shouldResume(saved: number, duration: number): boolean {
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return saved > 5 && saved < duration - 10;
}

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** Step the playback rate through SPEEDS by `dir` (±1), clamped. */
export function stepSpeed(current: number, dir: 1 | -1): number {
  const i = SPEEDS.indexOf(current as typeof SPEEDS[number]);
  const base = i === -1 ? SPEEDS.indexOf(1) : i;
  const next = Math.min(SPEEDS.length - 1, Math.max(0, base + dir));
  return SPEEDS[next];
}
