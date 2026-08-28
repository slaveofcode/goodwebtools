/**
 * Host side of the "code canvas": pull the JS out of an LLM reply and run it in
 * the sandbox worker with a hard timeout. extractCode is pure/testable; the
 * worker run needs a real browser (OffscreenCanvas + Worker), so it's covered by
 * build + manual smoke.
 */

/** Pull JS out of a reply, tolerating a ```js fence; returns the code trimmed. */
export function extractCode(input: string): string {
  const fenced = input.match(/```(?:js|javascript|ts)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : input).trim();
}

export interface CanvasRunOpts { width?: number; height?: number; timeoutMs?: number }

/** Run drawing code in the sandbox worker; resolve with the rendered PNG blob. */
export async function runCanvasCode(code: string, opts: CanvasRunOpts = {}): Promise<Blob> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new Error('this browser has no OffscreenCanvas sandbox — try a cloud model’s SVG instead');
  }
  const timeoutMs = opts.timeoutMs ?? 6000;
  const worker = new Worker(new URL('./canvas-sandbox.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('drawing timed out — possible infinite loop')), timeoutMs);
      worker.onmessage = (e: MessageEvent) => {
        clearTimeout(timer);
        const d = e.data as { ok: boolean; buf?: ArrayBuffer; error?: string };
        if (d.ok && d.buf) resolve(new Blob([d.buf], { type: 'image/png' }));
        else reject(new Error(d.error || 'drawing failed'));
      };
      worker.onerror = ev => { clearTimeout(timer); reject(new Error(ev.message || 'sandbox error')); };
      worker.postMessage({ code, width: opts.width ?? 512, height: opts.height ?? 512 });
    });
  } finally {
    worker.terminate();
  }
}

/** Blob → data: URL (for inline <img> preview). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('could not read blob'));
    r.readAsDataURL(blob);
  });
}
