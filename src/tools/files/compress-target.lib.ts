/**
 * Shared helpers for "compress to a target file size" — pure.
 */

export type SizeUnit = 'KB' | 'MB';

export const TARGET_PRESETS: { label: string; bytes: number }[] = [
  { label: '50 KB', bytes: 50 * 1024 },
  { label: '100 KB', bytes: 100 * 1024 },
  { label: '200 KB', bytes: 200 * 1024 },
  { label: '500 KB', bytes: 500 * 1024 },
  { label: '1 MB', bytes: 1024 * 1024 },
  { label: '2 MB', bytes: 2 * 1024 * 1024 },
];

/** Convert a user-entered size + unit to bytes. */
export function targetToBytes(value: number, unit: SizeUnit): number {
  return Math.max(0, Math.round(value * (unit === 'MB' ? 1024 * 1024 : 1024)));
}

/** Percentage smaller `to` is than `from` (negative if it grew). */
export function pctSmaller(from: number, to: number): number {
  return from > 0 ? Math.round((1 - to / from) * 100) : 0;
}

/** Human-readable byte size. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
