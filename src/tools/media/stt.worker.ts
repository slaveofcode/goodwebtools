// Runs speech-to-text off the main thread so the UI never freezes during
// inference: Whisper (transformers.js) for the multilingual models, Cactus
// Whistle for the "Fast" model and live dictation.
import { createTranscriber, type SttModelId, type WhisperModelId } from './stt.engine';
import type { WhistleEngine } from './whistle.engine';
import { toWhistleLang, wordsToSegments, type WhistleOutput } from './whistle.lib';
import { createStubWhistle } from './whistle.stub';

interface WorkerCtx {
  postMessage(msg: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
}
const ctx = self as unknown as WorkerCtx;

export type WorkerRequest =
  | { id: number; type: 'transcribe'; audio: Float32Array; model: SttModelId; language?: string; stub?: boolean }
  | { id: number; type: 'stream-start'; stub?: boolean }
  | { id: number; type: 'stream-chunk'; pcm: Float32Array; language?: string }
  | { id: number; type: 'stream-stop' };

let whistle: Promise<WhistleEngine> | null = null;
let whistleIsStub = false;
/** A live stream was started and not yet stopped (e.g. the page was left mid-dictation). */
let streamOpen = false;

/** One Whistle engine per worker; the dev-only E2E stub never downloads anything. */
function getWhistle(id: number, stub = false): Promise<WhistleEngine> {
  if (!whistle || whistleIsStub !== stub) {
    whistleIsStub = stub;
    whistle = stub
      ? Promise.resolve(createStubWhistle())
      : import('./whistle.engine').then(m => m.createWhistle({}, r => ctx.postMessage({ id, type: 'progress', ratio: r })));
    whistle.catch(() => { whistle = null; });
  }
  return whistle;
}

const streamReply = (id: number, type: 'stream-update' | 'stream-final', out: WhistleOutput) =>
  ctx.postMessage({ id, type, words: out.words, pending: out.pending ?? '' });

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    switch (req.type) {
      case 'transcribe': {
        if (req.model === 'whistle') {
          const engine = await getWhistle(req.id, req.stub);
          ctx.postMessage({ id: req.id, type: 'ready' });
          const { words } = await engine.transcribe(req.audio, toWhistleLang(req.language ?? '') ?? null);
          ctx.postMessage({ id: req.id, type: 'result', segments: wordsToSegments(words) });
        } else {
          const engine = await createTranscriber(req.model as WhisperModelId, r => ctx.postMessage({ id: req.id, type: 'progress', ratio: r }));
          ctx.postMessage({ id: req.id, type: 'ready' });
          const segments = await engine.transcribe(req.audio, { language: req.language });
          ctx.postMessage({ id: req.id, type: 'result', segments });
        }
        break;
      }
      case 'stream-start': {
        const engine = await getWhistle(req.id, req.stub);
        // Close any stream a previous session left open so its words don't carry over.
        if (streamOpen) engine.streamStop();
        streamOpen = true;
        ctx.postMessage({ id: req.id, type: 'ready' });
        break;
      }
      case 'stream-chunk': {
        const engine = await getWhistle(req.id, whistleIsStub);
        streamReply(req.id, 'stream-update', engine.streamProcess(req.pcm, toWhistleLang(req.language ?? '') ?? null));
        break;
      }
      case 'stream-stop': {
        const engine = await getWhistle(req.id, whistleIsStub);
        streamOpen = false;
        streamReply(req.id, 'stream-final', engine.streamStop());
        break;
      }
    }
  } catch (err) {
    ctx.postMessage({ id: req.id, type: 'error', message: err instanceof Error ? err.message : 'Transcription failed' });
  }
};
