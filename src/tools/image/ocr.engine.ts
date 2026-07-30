import type { OcrBox } from './ocr-preprocess.lib';

export type OcrBackend = 'webgpu' | 'wasm';

export interface RawLine {
  text: string;
  box: OcrBox;
  confidence: number;
}

export interface OcrEngine {
  backend: OcrBackend;
  recognize(canvas: HTMLCanvasElement): Promise<RawLine[]>;
}

/**
 * Create the on-device OCR engine (English default model). This is the only file
 * that touches the OCR SDK; keep it thin so the SDK stays swappable. WebGPU is
 * used when the browser exposes it, otherwise the SDK falls back to WASM.
 *
 * `ppu-paddle-ocr/web` returns `RecognitionResult` items ({ text, box, confidence })
 * which already match our RawLine shape; `flatten: true` yields them in reading order.
 */
export async function createEngine(): Promise<OcrEngine> {
  const { PaddleOcrService, isWebGpuAvailable } = await import('ppu-paddle-ocr/web');
  const backend: OcrBackend = (await isWebGpuAvailable()) ? 'webgpu' : 'wasm';
  const service = new PaddleOcrService();
  await service.initialize();

  return {
    backend,
    async recognize(canvas: HTMLCanvasElement): Promise<RawLine[]> {
      const result = await service.recognize(canvas, { flatten: true });
      return result.results.map((r): RawLine => ({
        text: r.text,
        box: r.box,
        confidence: r.confidence,
      }));
    },
  };
}
