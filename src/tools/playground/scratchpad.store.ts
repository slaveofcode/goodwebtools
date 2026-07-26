import { openDB, type IDBPDatabase } from 'idb';

export interface ScratchFile {
  id: string;
  name: string;
  language: string;
  content: string;
}

const DB_NAME = 'gwt-scratchpad';
const STORE = 'files';

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadFiles(): Promise<ScratchFile[]> {
  return (await db()).getAll(STORE) as Promise<ScratchFile[]>;
}

export async function saveFiles(files: ScratchFile[]): Promise<void> {
  const database = await db();
  const tx = database.transaction(STORE, 'readwrite');
  await tx.objectStore(STORE).clear();
  for (const f of files) await tx.objectStore(STORE).put(f);
  await tx.done;
}
