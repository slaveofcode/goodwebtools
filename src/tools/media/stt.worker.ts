// Runs Whisper transcription off the main thread so the UI never freezes during
// inference (which can take a while for larger models on WASM/CPU).
import { createTranscriber, type SttModelId } from './stt.engine';

interface WorkerCtx {
  postMessage(msg: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
}
const ctx = self as unknown as WorkerCtx;

interface Req { audio: Float32Array; model: SttModelId; language?: string }

ctx.onmessage = async (e: MessageEvent<Req>) => {
  const { audio, model, language } = e.data;
  try {
    const engine = await createTranscriber(model, r => ctx.postMessage({ type: 'progress', ratio: r }));
    ctx.postMessage({ type: 'ready' });
    const segments = await engine.transcribe(audio, { language });
    ctx.postMessage({ type: 'result', segments });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : 'Transcription failed' });
  }
};
