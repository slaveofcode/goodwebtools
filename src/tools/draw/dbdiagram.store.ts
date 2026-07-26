import { openDB, type IDBPDatabase } from 'idb';

// Persist the DB diagram (DBML text + dragged node positions) locally so it
// survives reloads. IndexedDB (not localStorage) for consistency with other tools.
export interface DbDiagramDoc {
  dbml: string;
  positions: Record<string, { x: number; y: number }>;
  updatedAt: number;
}

const DB_NAME = 'gwt-dbdiagram';
const STORE = 'doc';
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

export async function loadDoc(): Promise<DbDiagramDoc | null> {
  try {
    return (await (await db()).get(STORE, KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function saveDoc(doc: DbDiagramDoc): Promise<void> {
  try {
    await (await db()).put(STORE, doc, KEY);
  } catch {
    /* storage unavailable / quota — best-effort */
  }
}
