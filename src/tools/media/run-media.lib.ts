// Run a media job on the fast engine (mediabunny) when the browser can, with
// ffmpeg.wasm as the safety net: if the fast run fails for any reason other
// than the user cancelling, the same job runs once more on ffmpeg.
import { getEncodeCaps } from '@/services/media/mediabunny.service';
import { cancelFFmpeg } from '@/services/ffmpeg.service';
import { chooseEngine, type Engine, type MediaJob } from './engine.lib';

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';
const abortError = () => new DOMException('Cancelled', 'AbortError');

/** Resolve `work`, or reject with AbortError as soon as `signal` aborts (calling `onAbort`). */
function abortable<T>(work: Promise<T>, signal: AbortSignal, onAbort: () => void): Promise<T> {
  if (signal.aborted) { onAbort(); return Promise.reject(abortError()); }
  return new Promise<T>((resolve, reject) => {
    const stop = () => { onAbort(); reject(abortError()); };
    signal.addEventListener('abort', stop, { once: true });
    work.then(
      (v) => { signal.removeEventListener('abort', stop); resolve(v); },
      (e) => { signal.removeEventListener('abort', stop); reject(e); },
    );
  });
}

export async function runWithFallback<T>(
  job: MediaJob,
  fast: (signal: AbortSignal) => Promise<T>,
  slow: () => Promise<T>,
  signal: AbortSignal,
): Promise<{ value: T; engine: Engine; fellBack: boolean }> {
  const runSlow = () => abortable(slow(), signal, cancelFFmpeg);
  const { engine } = chooseEngine(job, await getEncodeCaps());
  if (engine === 'ffmpeg') return { value: await runSlow(), engine: 'ffmpeg', fellBack: false };
  try {
    return { value: await fast(signal), engine: 'mediabunny', fellBack: false };
  } catch (e) {
    if (isAbort(e) || signal.aborted) throw isAbort(e) ? e : abortError();
    return { value: await runSlow(), engine: 'ffmpeg', fellBack: true };
  }
}
