import type { SttModelId } from './stt.engine';
import type { TranscriptSegment } from './stt.lib';
import type { WhistleWord } from './whistle.lib';

// A single long-lived worker so the model cache inside it persists across runs.
let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

/** Dev-server E2E runs (`?e2e`) use a scripted Whistle stub instead of the real model. */
function stubRequested(): boolean {
  return import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('e2e');
}

type Reply =
  | { id: number; type: 'progress'; ratio: number }
  | { id: number; type: 'ready' }
  | { id: number; type: 'result'; segments: TranscriptSegment[] }
  | { id: number; type: 'stream-update' | 'stream-final'; words: WhistleWord[]; pending: string }
  | { id: number; type: 'error'; message: string };

/** Send one request and resolve with its terminal reply (progress is forwarded). */
function call<T extends Reply['type']>(
  msg: Record<string, unknown>,
  done: T,
  transfer: Transferable[] = [],
  onProgress?: (ratio: number) => void,
): Promise<Extract<Reply, { type: T }>> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const id = nextId++;
    const onMessage = (e: MessageEvent<Reply>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === 'progress') onProgress?.(m.ratio);
      else if (m.type === done) { cleanup(); resolve(m as Extract<Reply, { type: T }>); }
      else if (m.type === 'error') { cleanup(); reject(new Error(m.message)); }
    };
    const onError = () => { cleanup(); reject(new Error('The transcription worker crashed.')); };
    const cleanup = () => {
      w.removeEventListener('message', onMessage as EventListener);
      w.removeEventListener('error', onError);
    };
    w.addEventListener('message', onMessage as EventListener);
    w.addEventListener('error', onError);
    w.postMessage({ ...msg, id }, transfer);
  });
}

/**
 * Transcribe on a background worker so the main thread (UI) stays responsive.
 * `onProgress` reports model-download progress (0..1). Resolves with the segments.
 */
export async function transcribeInWorker(
  audio: Float32Array,
  model: SttModelId,
  language: string | undefined,
  onProgress?: (ratio: number) => void,
): Promise<TranscriptSegment[]> {
  // Transfer the audio buffer to avoid a copy (we don't reuse it on this side).
  const reply = await call(
    { type: 'transcribe', audio, model, language, stub: stubRequested() },
    'result',
    [audio.buffer],
    onProgress,
  );
  return reply.segments;
}

export interface LiveUpdate { words: WhistleWord[]; pending: string }

/** Live dictation over the worker's Whistle engine (start → chunks → stop). */
export const liveStream = {
  /** Load the engine (download on first use); resolves when ready. */
  start(onProgress?: (ratio: number) => void): Promise<void> {
    return call({ type: 'stream-start', stub: stubRequested() }, 'ready', [], onProgress).then(() => undefined);
  },
  /** Append ~1 s of 16 kHz mono audio; resolves with newly committed words + pending tail. */
  push(pcm: Float32Array, language: string | undefined): Promise<LiveUpdate> {
    return call({ type: 'stream-chunk', pcm, language }, 'stream-update', [pcm.buffer]);
  },
  /** End the stream; resolves with the final committed words. */
  stop(): Promise<LiveUpdate> {
    return call({ type: 'stream-stop' }, 'stream-final');
  },
};
