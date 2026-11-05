// The last recording and full-page screenshot, kept in the extension's own
// IndexedDB so the page that makes them and the page that shows them can share them.

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
export function saveRecording(rec, key = 'last') {
  return run('readwrite', (s) => s.put(rec, key));
}

export function loadRecording(key = 'last') {
  return run('readonly', (s) => s.get(key));
}

/** The latest full-page screenshot ({ blob, width, height, truncated, title, at }). */
export const saveShot = (shot) => saveRecording(shot, 'shot');
export const loadShot = () => loadRecording('shot');
