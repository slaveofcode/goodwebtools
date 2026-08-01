import type { TranscriptSegment } from './stt.lib';

export type SttBackend = 'webgpu' | 'wasm';

export type SttModelId =
  | 'onnx-community/whisper-tiny.en'
  | 'onnx-community/whisper-base.en'
  | 'onnx-community/whisper-base';

export interface Transcriber {
  backend: SttBackend;
  transcribe(audio: Float32Array): Promise<TranscriptSegment[]>;
}

interface AsrChunk {
  timestamp: [number, number | null];
  text: string;
}

async function webgpuAvailable(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return false;
    const adapter = await gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

// Cache the built pipeline so repeated transcriptions with the same model reuse
// it — otherwise every run re-initializes the ONNX session (re-reading weights,
// re-running the load progress, blocking the main thread).
let cached: { model: SttModelId; transcriber: Transcriber } | null = null;

/** Drop the cached transcriber (e.g. for tests). */
export function resetTranscriber(): void {
  cached = null;
}

/**
 * Create the on-device speech-to-text engine. This is the ONLY file that touches
 * transformers.js — keep it thin so the SDK stays swappable. WebGPU is used when
 * available, otherwise a quantized WASM model keeps the download smaller.
 *
 * Audio never leaves the browser; only the model weights are fetched (from the HF
 * CDN) the first time a model is used, then cached by the browser. The built
 * pipeline is cached in-memory so subsequent runs skip re-initialization.
 */
export async function createTranscriber(
  model: SttModelId,
  onProgress?: (ratio: number) => void,
): Promise<Transcriber> {
  if (cached && cached.model === model) return cached.transcriber;

  const { pipeline } = await import('@huggingface/transformers');
  const backend: SttBackend = (await webgpuAvailable()) ? 'webgpu' : 'wasm';

  const pipe = await pipeline('automatic-speech-recognition', model, {
    device: backend,
    // Whisper is an encoder-decoder model. Per-module dtype is required: the
    // quantized (q8/q4) decoder — which holds embed_tokens — trips an ONNX Runtime
    // "MatMulNBits: Missing required scale" error, so load the decoder full
    // precision. The encoder can stay quantized to keep the download smaller.
    dtype: { encoder_model: backend === 'webgpu' ? 'fp32' : 'q8', decoder_model_merged: 'fp32' },
    progress_callback: (p: { status?: string; progress?: number }) => {
      if (onProgress && p?.status === 'progress' && typeof p.progress === 'number') {
        onProgress(Math.min(1, Math.max(0, p.progress / 100)));
      }
    },
  });

  const transcriber: Transcriber = {
    backend,
    async transcribe(audio: Float32Array): Promise<TranscriptSegment[]> {
      const out = (await pipe(audio, {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      })) as { text: string; chunks?: AsrChunk[] };

      if (out.chunks && out.chunks.length > 0) {
        return out.chunks.map((c): TranscriptSegment => ({
          start: c.timestamp?.[0] ?? 0,
          end: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0,
          text: c.text ?? '',
        }));
      }
      // No timestamps returned — fall back to a single segment.
      return [{ start: 0, end: 0, text: out.text ?? '' }];
    },
  };

  cached = { model, transcriber };
  return transcriber;
}
