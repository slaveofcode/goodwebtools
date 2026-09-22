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

export async function saveScene(scene: WhiteboardScene): Promise<boolean> {
  try {
    // JSON round-trip guarantees a plain, structured-cloneable object before it
    // hits IndexedDB. Excalidraw elements are JSON-serialisable (that's the
    // .excalidraw file format), so this is lossless but avoids any rare
    // DataCloneError from a live element object slipping through and silently
    // failing the write. Returns whether the write actually succeeded.
    const plain = JSON.parse(JSON.stringify(scene)) as WhiteboardScene;
    await (await db()).put(STORE, plain, KEY);
    return true;
  } catch {
    return false;
  }
}

/** Outcome of trying to write the scene back to the user's opened .excalidraw file. */
export type FileSaveResult = 'saved' | 'no-permission' | 'unsupported' | 'error';

// Minimal shape of a File System Access handle. `queryPermission`/`createWritable`
// aren't in the standard TS DOM lib, so we type just what we use.
interface WritableFileHandle {
  createWritable?: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
  queryPermission?: (opts: { mode: 'readwrite' }) => Promise<PermissionState>;
}

/**
 * Write the serialized .excalidraw contents back to the file the user opened
 * (Excalidraw exposes it as `appState.fileHandle`). This is what keeps the
 * on-disk file — not just the browser copy — in sync with autosave.
 *
 * It only writes when the handle ALREADY has read-write permission and never
 * prompts: autosave runs on a timer with no user gesture, and the File System
 * Access permission prompt requires one. When permission isn't granted yet it
 * returns 'no-permission' so the caller can nudge the user to press Save (⌘S),
 * which grants it; after that first Save, autosave keeps the file in sync.
 */
export async function saveToFileHandle(
  handle: FileSystemFileHandle | null | undefined,
  contents: string,
): Promise<FileSaveResult> {
  const h = handle as WritableFileHandle | null | undefined;
  if (!h || typeof h.createWritable !== 'function') return 'unsupported';
  try {
    const perm = typeof h.queryPermission === 'function'
      ? await h.queryPermission({ mode: 'readwrite' })
      : 'granted';
    if (perm !== 'granted') return 'no-permission';
    const writable = await h.createWritable();
    await writable.write(contents);
    await writable.close();
    return 'saved';
  } catch {
    return 'error';
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
