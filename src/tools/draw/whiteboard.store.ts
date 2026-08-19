import { openDB, type IDBPDatabase } from 'idb';

// Persist the whiteboard scene locally (IndexedDB) so it survives reloads, tab
// closes, and reboots — auto-saved on every change. Images can be large, so this
// uses IndexedDB rather than localStorage.
export interface WhiteboardScene {
  elements: readonly unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

const DB_NAME = 'gwt-whiteboard';
const STORE = 'scene';
const KEY = 'current';

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

export async function loadScene(): Promise<WhiteboardScene | null> {
  try {
    return (await (await db()).get(STORE, KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function saveScene(scene: WhiteboardScene): Promise<void> {
  try {
    await (await db()).put(STORE, scene, KEY);
  } catch {
    /* storage unavailable / quota — best-effort */
  }
}

/** Default autosave timings (ms). Exported so the island and tests agree. */
export const AUTOSAVE_DEBOUNCE_MS = 800;
export const AUTOSAVE_MAX_WAIT_MS = 5000;

/**
 * Decide whether buffered changes should be flushed to storage now. Pure so it
 * can be unit-tested; the island polls it on a short tick with live timings.
 *
 * Saves when the user has been idle for `debounceMs` (they paused drawing), or
 * — so continuous drawing still persists — once changes have been pending for
 * `maxWaitMs` regardless of idle time.
 */
export function shouldAutosave(opts: {
  dirty: boolean;
  idleMs: number;      // time since the last detected change
  dirtyForMs: number;  // time since changes first became unsaved
  debounceMs?: number;
  maxWaitMs?: number;
}): boolean {
  const { dirty, idleMs, dirtyForMs, debounceMs = AUTOSAVE_DEBOUNCE_MS, maxWaitMs = AUTOSAVE_MAX_WAIT_MS } = opts;
  if (!dirty) return false;
  return idleMs >= debounceMs || dirtyForMs >= maxWaitMs;
}
