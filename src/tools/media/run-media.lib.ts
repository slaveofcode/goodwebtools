// Run a media job on the fast engine (mediabunny) when the browser can, with
// ffmpeg.wasm as the safety net: if the fast run fails for any reason other
// than the user cancelling, the same job runs once more on ffmpeg.
import { getEncodeCaps } from '@/services/media/mediabunny.service';
import { cancelFFmpeg, beginFFmpegJob } from '@/services/ffmpeg.service';
import { chooseEngine, type Engine, type MediaJob } from './engine.lib';

/** A problem with the file itself (e.g. no audio track): shown to the user, never retried on ffmpeg. */
export class MediaInputError extends Error {}

/** Why a job ran (or would have to run) in compatibility mode. */
export type SlowReason = 'container' | 'video-codec' | 'audio-codec' | 'no-webcodecs' | 'cannot-decode' | 'stalled' | 'fast-failed';

/**
 * Compatibility mode (ffmpeg.wasm) copies the whole file into memory before it
 * starts, so above this size it can only run out of memory — on a phone well
 * before a computer. Past the limit we say why instead of trying.
 */
export function compatLimitBytes(mobile: boolean): number {
  return (mobile ? 300 : 1024) * 1024 * 1024;
}

/** Whether this looks like a phone or tablet browser. */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof uaData?.mobile === 'boolean' && uaData.mobile) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

/** The fast engine can't do this file, and the file is too big for compatibility mode. */
export class TooBigForCompatibilityError extends Error {
  constructor(readonly reason: SlowReason, readonly bytes: number, readonly limit: number) {
    super(`too-big-for-compatibility: ${reason}`);
  }
}

/** Why the fast engine gave up, from its error. */
export function slowReasonOf(e: unknown): SlowReason {
  const m = e instanceof Error ? e.message : String(e);
  if (m.startsWith('mb-cannot-decode') || m.startsWith('mb-dropped')) return 'cannot-decode';
  if (m.startsWith('mb-stalled')) return 'stalled';
  if (m.startsWith('mb-no-encoder')) return 'video-codec';
  return 'fast-failed';
}

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
  opts: { inputBytes?: number; mobile?: boolean } = {},
): Promise<{ value: T; engine: Engine; fellBack: boolean; slowReason: SlowReason | null }> {
  const limit = compatLimitBytes(opts.mobile ?? isMobileDevice());
  const runSlow = (reason: SlowReason) => {
    // Never start ffmpeg for a job that's already cancelled; give it a fresh cancel scope.
    if (signal.aborted) return Promise.reject(abortError());
    // Too big for ffmpeg.wasm: it would only run out of memory. Say why instead.
    if (opts.inputBytes && opts.inputBytes > limit) return Promise.reject(new TooBigForCompatibilityError(reason, opts.inputBytes, limit));
    beginFFmpegJob();
    const work = slow();
    // Once a cancelled job has really stopped, lift the cancel for later jobs.
    work.catch(() => {}).finally(() => { if (signal.aborted) beginFFmpegJob(); });
    return abortable(work, signal, cancelFFmpeg);
  };
  // If the fast engine can't even load (network, stale page), use ffmpeg.
  const caps = await getEncodeCaps().catch(() => null);
  if (signal.aborted) throw abortError();
  const { engine, reason } = chooseEngine(job, caps);
  if (engine === 'ffmpeg') {
    const why = reason === 'ok' ? 'fast-failed' : reason;
    return { value: await runSlow(why), engine: 'ffmpeg', fellBack: false, slowReason: why };
  }
  try {
    return { value: await fast(signal), engine: 'mediabunny', fellBack: false, slowReason: null };
  } catch (e) {
    if (isAbort(e) || signal.aborted) throw isAbort(e) ? e : abortError();
    if (e instanceof MediaInputError) throw e;
    const why = slowReasonOf(e);
    return { value: await runSlow(why), engine: 'ffmpeg', fellBack: true, slowReason: why };
  }
}
