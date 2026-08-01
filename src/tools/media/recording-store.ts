// Persist the last recorded/loaded audio clip in IndexedDB so it survives a page
// reload — e.g. when a phone locks during a long transcription and the browser
// discards the tab. Blobs can't go in localStorage, hence IndexedDB.

const DB_NAME = 'gwt-voice';
const STORE = 'recordings';
const KEY = 'last';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording(blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* best-effort */ }
}

export async function loadRecording(): Promise<Blob | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob instanceof Blob ? blob : null;
  } catch {
    return null;
  }
}

export async function clearRecording(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>(resolve => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch { /* best-effort */ }
}
