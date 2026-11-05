// Single-use store for data the Companion hands to a tool page. Payloads live in
// memory and, when small enough, in chrome.storage.session (in case the service
// worker restarts before the tab asks for them). Each expires after 5 minutes.

export const TTL_MS = 5 * 60 * 1000;
const PREFIX = 'handoff:';

/** Random, URL-safe id (matches the site's /^[A-Za-z0-9-]{8,64}$/). */
export function newHandoffId(rand = crypto) {
  return rand.randomUUID();
}

export function isFresh(entry, now = Date.now()) {
  return !!entry && now - entry.at < TTL_MS;
}

/** Bytes → base64 without blowing the call stack on large files. */
export function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export function createHandoffStore(session) {
  const memory = new Map();
  return {
    async put(payload, now = Date.now()) {
      const id = newHandoffId();
      const entry = { payload, at: now };
      memory.set(id, entry);
      try { await session?.set({ [PREFIX + id]: entry }); } catch { /* too big for session storage — memory only */ }
      return id;
    },
    async take(id, now = Date.now()) {
      let entry = memory.get(id);
      memory.delete(id);
      if (!entry && session) {
        const got = await session.get(PREFIX + id);
        entry = got?.[PREFIX + id];
      }
      try { await session?.remove(PREFIX + id); } catch { /* ignore */ }
      return isFresh(entry, now) ? entry.payload : null;
    },
  };
}
