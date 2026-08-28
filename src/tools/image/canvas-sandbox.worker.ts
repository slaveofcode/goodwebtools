/**
 * Sandbox for running LLM-written 2D drawing code (agent v2 "code canvas").
 *
 * Runs in a Web Worker — so no DOM, no window, no cookies/localStorage. Before
 * executing any user code we also neuter the exfiltration + storage channels a
 * Worker *does* have (fetch/XHR/WebSocket/importScripts/indexedDB/caches). The
 * code only ever sees an OffscreenCanvas + its 2D context, and the main thread
 * enforces a wall-clock timeout by terminating this worker. The result is a PNG.
 */

const blocked = () => { throw new Error('disabled in the drawing sandbox'); };
for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'indexedDB', 'caches', 'EventSource', 'SharedWorker', 'Worker', 'Notification']) {
  try { Object.defineProperty(self, key, { value: blocked, writable: false, configurable: false }); } catch { /* some are non-configurable already */ }
}

interface Job { code: string; width: number; height: number }

self.onmessage = async (e: MessageEvent<Job>) => {
  const { code, width, height } = e.data;
  const post = (msg: unknown, transfer?: Transferable[]) => (self as unknown as Worker).postMessage(msg, transfer ?? []);
  try {
    const w = Math.max(1, Math.min(4096, Math.floor(width) || 512));
    const h = Math.max(1, Math.min(4096, Math.floor(height) || 512));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('could not get a 2D context');
    // The drawing code sees only `canvas`, `ctx`, and safe math/date globals.
    const draw = new Function('canvas', 'ctx', 'Math', 'Date', `"use strict";\n${code}`);
    await draw(canvas, ctx, Math, Date);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const buf = await blob.arrayBuffer();
    post({ ok: true, buf }, [buf]);
  } catch (err) {
    post({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
