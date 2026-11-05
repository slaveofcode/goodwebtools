// The last recording, kept in the extension's own IndexedDB so the offscreen
// document (which records) and recording.html (which shows it) can share it.

const DB = 'gwt-companion';
const STORE = 'recordings';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

/** Save the latest recording ({ blob, type, durationMs, at }). */
export function saveRecording(rec) {
  return run('readwrite', (s) => s.put(rec, 'last'));
}

export function loadRecording() {
  return run('readonly', (s) => s.get('last'));
}
