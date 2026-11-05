// Bridge to the optional GoodWebTools Companion browser extension. Everything here
// is progressive enhancement: if the extension isn't installed, detection simply
// resolves false and tools fall back to their pure-web flow. Communication is via
// window.postMessage (see extension/content.js) so it works regardless of the
// extension's id (unpacked / self-hosted builds included).

const PAGE = 'gwt-page';
const EXT = 'gwt-ext';

export interface CompanionCapture {
  dataUrl: string;
  width: number;
  height: number;
}

let nextId = 1;

/** Resolves true if the companion extension answers a ping within `timeout` ms. */
export function detectCompanion(timeout = 600): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const id = `ping-${nextId++}`;
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMsg);
      resolve(v);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      // Accept a direct pong, or the content script's unsolicited "hello" pong.
      if (d && d.source === EXT && d.type === 'pong' && (d.id === id || d.id === 'hello')) {
        finish(true);
      }
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ source: PAGE, type: 'ping', id }, window.location.origin);
    setTimeout(() => finish(false), timeout);
  });
}

/** Ask the extension to capture the screen; resolves the full-frame PNG. */
export function companionCapture(timeout = 120000): Promise<CompanionCapture> {
  return new Promise((resolve, reject) => {
    const id = `cap-${nextId++}`;
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      fn();
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.source !== EXT || d.type !== 'capture-result' || d.id !== id) return;
      if (d.ok && d.dataUrl) finish(() => resolve({ dataUrl: d.dataUrl, width: d.width, height: d.height }));
      else finish(() => reject(new Error(d.error || 'capture-failed')));
    };
    const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), timeout);
    window.addEventListener('message', onMsg);
    window.postMessage({ source: PAGE, type: 'capture', id }, window.location.origin);
  });
}

/** Data the extension hands to a tool page (right-click menu / launcher). */
export type HandoffPayload =
  | { kind: 'text'; text: string }
  | { kind: 'file'; name: string; type: string; base64: string };

/** Fetch a handoff payload from the extension by id; null if it's gone, expired or there's no extension. */
export function requestHandoff(id: string, timeout = 5000): Promise<HandoffPayload | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const reqId = `handoff-${nextId++}`;
    let done = false;
    const finish = (v: HandoffPayload | null) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      resolve(v);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.source !== EXT || d.type !== 'handoff-result' || d.id !== reqId) return;
      finish(d.ok && d.payload ? (d.payload as HandoffPayload) : null);
    };
    const timer = setTimeout(() => finish(null), timeout);
    window.addEventListener('message', onMsg);
    window.postMessage({ source: PAGE, type: 'handoff-get', id: reqId, handoffId: id }, window.location.origin);
  });
}
