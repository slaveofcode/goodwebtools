/**
 * Pure helpers for the P2P file-transfer data-channel protocol. The wire format is:
 *   1. one JSON control message: { kind: 'meta', name, size, mime }
 *   2. then `chunkCount(size)` binary ArrayBuffer chunks of CHUNK_SIZE bytes.
 */

export const CHUNK_SIZE = 16 * 1024; // 16 KB — safe for RTCDataChannel

export interface TransferMeta {
  name: string;
  size: number;
  mime: string;
}

/** Number of chunks a file of `size` bytes splits into. */
export function chunkCount(size: number, chunkSize: number = CHUNK_SIZE): number {
  if (size <= 0) return 0;
  return Math.ceil(size / chunkSize);
}

/** Byte range [start, end) for chunk `index`, clamped to `size`. */
export function chunkRange(index: number, size: number, chunkSize: number = CHUNK_SIZE): [number, number] {
  const start = index * chunkSize;
  const end = Math.min(start + chunkSize, size);
  return [start, end];
}

/** Clamped 0..100 integer progress. */
export function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`;
}

/** Encode the leading control message. */
export function encodeMeta(meta: TransferMeta): string {
  return JSON.stringify({ kind: 'meta', name: meta.name, size: meta.size, mime: meta.mime });
}

/** Decode + validate the leading control message. Returns null if invalid. */
export function decodeMeta(raw: string): TransferMeta | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const m = obj as Record<string, unknown>;
  if (m.kind !== 'meta') return null;
  if (typeof m.name !== 'string' || typeof m.size !== 'number' || typeof m.mime !== 'string') return null;
  return { name: m.name, size: m.size, mime: m.mime };
}
