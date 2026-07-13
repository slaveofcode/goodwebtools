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
