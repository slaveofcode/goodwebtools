/**
 * Sandbox for running LLM-written DATA-transform code (agent v3 "data interpreter").
 *
 * Same lock-down as the canvas sandbox: a Web Worker (no DOM), with the
 * exfiltration/storage channels neutered, and a wall-clock timeout enforced by
 * the main thread. The code gets the file's text as `input` plus small CSV/JSON
 * helpers, and returns the transformed text.
 */

const blocked = () => { throw new Error('disabled in the data sandbox'); };
for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'indexedDB', 'caches', 'EventSource', 'SharedWorker', 'Worker', 'Notification']) {
  try { Object.defineProperty(self, key, { value: blocked, writable: false, configurable: false }); } catch { /* non-configurable */ }
}

/** Parse a CSV line into fields, honoring double-quoted cells. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const parseCSV = (text: string): string[][] => text.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(splitCsvLine);
const toCSV = (rows: unknown[][]): string =>
  rows.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');

self.onmessage = async (e: MessageEvent<{ code: string; input: string }>) => {
  const { code, input } = e.data;
  const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);
  try {
    // The code sees `input` (file text) + helpers, and returns the output string.
    const fn = new Function('input', 'parseCSV', 'toCSV', 'JSON', 'Math', 'Date',
      `"use strict";\nlet output;\n${code}\n;return (typeof output !== 'undefined') ? output : undefined;`);
    let out = await fn(input, parseCSV, toCSV, JSON, Math, Date);
    if (out === undefined || out === null) throw new Error('the code produced no output — set `output` or return a value');
    post({ ok: true, output: typeof out === 'string' ? out : JSON.stringify(out, null, 2) });
  } catch (err) {
    post({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
