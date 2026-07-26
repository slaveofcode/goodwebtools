import { openDB, type IDBPDatabase } from 'idb';

// A one-shot IndexedDB channel for passing an image between tools across a full
// page navigation (Astro reloads the page). localStorage is too small for images.
interface PendingRecord {
  blob: Blob;
  name: string;
  ts: number;
}

const DB_NAME = 'gwt-handoff';
const STORE = 'image';
const KEY = 'pending';
const DEFAULT_MAX_AGE = 60_000; // 1 minute

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

/** A record stamped at `ts` is fresh if `now` is within `maxAgeMs` of it. */
export function isFresh(ts: number, now: number, maxAgeMs: number): boolean {
  return now - ts <= maxAgeMs;
}

/** Store an image for the next tool to pick up. Overwrites any pending image. */
export async function putPendingImage(blob: Blob, name: string): Promise<void> {
  try {
    await (await db()).put(STORE, { blob, name, ts: Date.now() } satisfies PendingRecord, KEY);
  } catch {
    /* storage unavailable / quota — handoff is best-effort */
  }
}

/** Read and delete the pending image, if any and still fresh. */
export async function takePendingImage(
  maxAgeMs = DEFAULT_MAX_AGE,
): Promise<{ blob: Blob; name: string } | null> {
  try {
    const conn = await db();
    const rec = (await conn.get(STORE, KEY)) as PendingRecord | undefined;
    await conn.delete(STORE, KEY); // one-shot: always clear
    if (!rec || !isFresh(rec.ts, Date.now(), maxAgeMs)) return null;
    return { blob: rec.blob, name: rec.name };
  } catch {
    return null;
  }
}

/** Store the image, then navigate to the annotator, which loads it on mount. */
export async function sendImageToAnnotator(blob: Blob, name = 'image.png'): Promise<void> {
  await putPendingImage(blob, name);
  window.location.href = '/tools/image-annotate';
}
