/**
 * Pure time-formatting + alarm-scheduling helpers for the Stopwatch / Timer /
 * Alarm hub. Kept free of timers and DOM so they can be unit-tested; the ticking
 * intervals, audio and notifications live in the island.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Format elapsed milliseconds as `M:SS.cs` (or `H:MM:SS.cs`) for a stopwatch. */
export function formatStopwatch(ms: number): string {
  if (!(ms > 0)) ms = 0;
  const cs = Math.floor((ms % 1000) / 10);
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const base = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return `${base}.${pad(cs)}`;
}

/** Format remaining milliseconds as `M:SS` (or `H:MM:SS`), rounded up to the second. */
export function formatCountdown(ms: number): string {
  if (!(ms > 0)) ms = 0;
  const totalSec = Math.ceil(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Milliseconds from `nowMsOfDay` (ms since local midnight) until the next
 * occurrence of the wall-clock time `hh:mm`. If that time has already passed
 * today (or is exactly now), it schedules for tomorrow.
 */
export function msUntilNext(nowMsOfDay: number, hh: number, mm: number): number {
  const DAY = 86_400_000;
  const targetMs = (hh * 60 + mm) * 60_000;
  let diff = targetMs - nowMsOfDay;
  if (diff <= 0) diff += DAY;
  return diff;
}

/** Convert a Date into milliseconds since local midnight. */
export function msOfDay(d: Date): number {
  return ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
}
