/**
 * Clipboard Inspector — reads the system clipboard via the Clipboard API
 * and paste events, returning typed, previewable entries.
 *
 * Two paths:
 *  - navigator.clipboard.read()  → text, HTML, images (needs permission)
 *  - DataTransfer from paste evt → any file type (video, audio, binary…)
 */

export type PreviewKind = 'text' | 'html' | 'image' | 'video' | 'audio' | 'pdf' | 'binary';

export interface ClipboardItemEntry {
  /** MIME type reported by the clipboard / file */
  type: string;
  kind: PreviewKind;
  /** Populated for text/plain and text/html */
  text?: string;
  /** Populated for binary types — caller owns this URL and must revoke it */
  blobUrl?: string;
  size: number;
  /** Set when the item originated from a file (paste of a file from disk) */
  filename?: string;
}

export interface ClipboardSnapshot {
  id: string;
  timestamp: number;
  source: 'read' | 'paste';
  items: ClipboardItemEntry[];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function previewKindOf(mimeType: string): PreviewKind {
  const t = mimeType.toLowerCase().split(';')[0].trim();
  if (t === 'text/plain') return 'text';
  if (t === 'text/html') return 'html';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t === 'application/pdf') return 'pdf';
  return 'binary';
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'text/plain': 'txt',
    'text/html': 'html',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'weba',
    'audio/flac': 'flac',
    'application/pdf': 'pdf',
  };
  const t = mimeType.toLowerCase().split(';')[0].trim();
  return map[t] ?? t.split('/')[1] ?? 'bin';
}

// ─── Clipboard API read ───────────────────────────────────────────────────────

/**
 * Read the current clipboard using the Clipboard API.
 * Requires clipboard-read permission (browser may prompt).
 * Only exposes types the browser allows (typically text, HTML, images).
 */
export async function readClipboard(): Promise<ClipboardItemEntry[]> {
  const entries: ClipboardItemEntry[] = [];
  const clipItems = await navigator.clipboard.read();
  for (const ci of clipItems) {
    for (const type of ci.types) {
      const blob = await ci.getType(type);
      const kind = previewKindOf(type);
      if (kind === 'text' || kind === 'html') {
        const text = await blob.text();
        entries.push({ type, kind, text, size: blob.size });
      } else {
        entries.push({ type, kind, blobUrl: URL.createObjectURL(blob), size: blob.size });
      }
    }
  }
  return entries;
}

// ─── DataTransfer (paste event) ──────────────────────────────────────────────

/**
 * Extract all items from a DataTransfer (paste event).
 * Files (video, audio, etc.) come from dt.items[].getAsFile().
 * Text types are read synchronously via dt.getData().
 */
export function parseDataTransfer(dt: DataTransfer): ClipboardItemEntry[] {
  const entries: ClipboardItemEntry[] = [];
  const seenTypes = new Set<string>();

  // File items — covers images, video, audio, documents pasted from disk
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (!file) continue;
    const mimeType = (item.type || file.type || 'application/octet-stream').toLowerCase();
    if (seenTypes.has(mimeType)) continue;
    seenTypes.add(mimeType);
    entries.push({
      type: mimeType,
      kind: previewKindOf(mimeType),
      blobUrl: URL.createObjectURL(file),
      size: file.size,
      filename: file.name || undefined,
    });
  }

  // String items — text/plain, text/html, and any other text types
  for (const rawType of Array.from(dt.types)) {
    if (rawType === 'Files' || seenTypes.has(rawType)) continue;
    const data = dt.getData(rawType);
    if (!data) continue;
    seenTypes.add(rawType);
    const encoder = new TextEncoder();
    entries.push({
      type: rawType,
      kind: previewKindOf(rawType),
      text: data,
      size: encoder.encode(data).length,
    });
  }

  return entries;
}
