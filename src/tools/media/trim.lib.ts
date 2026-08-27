/**
 * Pure time-range helpers for the Audio/Video Trimmer. Parsing, formatting and
 * validating the [start, end] selection is all testable without a real decoder;
 * the ffmpeg cut itself lives in the island.
 */

/** Shortest selection we allow (seconds) — avoids empty/degenerate cuts. */
export const MIN_TRIM_SEC = 0.1;

/**
 * Parse a time string to seconds. Accepts `SS`, `MM:SS`, `HH:MM:SS`, each with
 * an optional `.fraction`. Returns null on anything malformed or out of range
 * (minutes/seconds must be 0–59).
 */
export function parseTime(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(s)) return null;
  const parts = s.split(':');
  const nums = parts.map(Number);
  if (nums.some(n => Number.isNaN(n))) return null;

  let h = 0, m = 0, sec = 0;
  if (nums.length === 1) [sec] = nums;
  else if (nums.length === 2) [m, sec] = nums;
  else [h, m, sec] = nums;

  // For MM:SS / HH:MM:SS forms the sub-fields can't overflow 59.
  if (nums.length >= 2 && sec >= 60) return null;
  if (nums.length === 3 && m >= 60) return null;
  return h * 3600 + m * 60 + sec;
}

/** Format seconds as `M:SS`, `H:MM:SS`, keeping up to one decimal of fraction. */
export function formatTime(total: number): string {
  if (!Number.isFinite(total) || total < 0) total = 0;
  const whole = Math.floor(total);
  const frac = total - whole;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const fracStr = frac > 0 ? `.${Math.round(frac * 10)}` : '';
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}${fracStr}`;
  return `${m}:${ss}${fracStr}`;
}

export interface TrimRange {
  start: number;
  end: number;
  duration: number;
}
export interface TrimValidation {
  ok: boolean;
  error?: 'range' | 'bounds' | 'tooShort';
}

/** Validate a [start, end] selection against the clip duration. */
export function validateTrim({ start, end, duration }: TrimRange): TrimValidation {
  if (start < 0 || end > duration + 0.05) return { ok: false, error: 'bounds' };
  if (end <= start) return { ok: false, error: 'range' };
  if (end - start < MIN_TRIM_SEC) return { ok: false, error: 'tooShort' };
  return { ok: true };
}

/** Clamp a raw [start, end] into a valid, ordered range within [0, duration]. */
export function clampTrim(start: number, end: number, duration: number): { start: number; end: number } {
  const s = Math.min(Math.max(0, start), duration);
  const e = Math.min(Math.max(0, end), duration);
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}
