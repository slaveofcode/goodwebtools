import type { SttModelId } from './stt.engine';
import type { TranscriptSegment } from './stt.lib';

// A single long-lived worker so the model cache inside it persists across runs.
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

interface ProgressMsg { type: 'progress'; ratio: number }
interface ReadyMsg { type: 'ready' }
interface ResultMsg { type: 'result'; segments: TranscriptSegment[] }
interface ErrorMsg { type: 'error'; message: string }
type WorkerMsg = ProgressMsg | ReadyMsg | ResultMsg | ErrorMsg;

/**
 * Transcribe on a background worker so the main thread (UI) stays responsive.
 * `onProgress` reports model-download progress (0..1). Resolves with the segments.
 */
export function transcribeInWorker(
  audio: Float32Array,
  model: SttModelId,
  language: string | undefined,
  onProgress?: (ratio: number) => void,
): Promise<TranscriptSegment[]> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMessage = (e: MessageEvent<WorkerMsg>) => {
      const m = e.data;
      if (m.type === 'progress') onProgress?.(m.ratio);
      else if (m.type === 'result') { cleanup(); resolve(m.segments); }
      else if (m.type === 'error') { cleanup(); reject(new Error(m.message)); }
    };
    const onError = () => { cleanup(); reject(new Error('The transcription worker crashed.')); };
    const cleanup = () => {
      w.removeEventListener('message', onMessage as EventListener);
      w.removeEventListener('error', onError);
    };
    w.addEventListener('message', onMessage as EventListener);
    w.addEventListener('error', onError);
    // Transfer the audio buffer to avoid a copy (we don't reuse it on this side).
    w.postMessage({ audio, model, language }, [audio.buffer]);
  });
}
