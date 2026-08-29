/**
 * Host side of the data interpreter. `peekData` builds a small schema sample the
 * model reads before writing a transform (pure/testable); `runDataCode` runs the
 * code in the sandbox worker with a timeout (needs a real browser).
 */

/** A compact preview of a file's shape: dimensions + the first rows. */
export function peekData(text: string, maxLines = 15): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l, i, a) => i < a.length - 1 || l.length > 0);
  const head = lines.slice(0, maxLines);
  const looksCsv = /,/.test(head[0] ?? '');
  const cols = looksCsv ? (head[0]?.split(',').length ?? 0) : 0;
  const meta = `${lines.length} line${lines.length === 1 ? '' : 's'}` + (looksCsv ? `, ~${cols} columns (CSV)` : '');
  return `${meta}\n\nFirst ${head.length} line${head.length === 1 ? '' : 's'}:\n${head.join('\n')}${lines.length > maxLines ? '\n…' : ''}`;
}

export interface DataRunOpts { timeoutMs?: number }

/** Run a data-transform in the sandbox worker; resolve with the output text. */
export async function runDataCode(code: string, input: string, opts: DataRunOpts = {}): Promise<string> {
  if (typeof Worker === 'undefined') throw new Error('this browser cannot run the data sandbox');
  const timeoutMs = opts.timeoutMs ?? 8000;
  const worker = new Worker(new URL('./data-sandbox.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the transform timed out — possible infinite loop')), timeoutMs);
      worker.onmessage = (e: MessageEvent) => {
        clearTimeout(timer);
        const d = e.data as { ok: boolean; output?: string; error?: string };
        if (d.ok && typeof d.output === 'string') resolve(d.output);
        else reject(new Error(d.error || 'transform failed'));
      };
      worker.onerror = ev => { clearTimeout(timer); reject(new Error(ev.message || 'sandbox error')); };
      worker.postMessage({ code, input });
    });
  } finally {
    worker.terminate();
  }
}
