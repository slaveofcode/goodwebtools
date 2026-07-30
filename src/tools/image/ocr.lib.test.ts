import { describe, it, expect, vi, beforeEach } from 'vitest';

const createEngine = vi.fn();
vi.mock('./ocr.engine', () => ({ createEngine: () => createEngine() }));

import { recognize, getEngine, resetEngine, OcrError } from './ocr.lib';

function line(text: string, x: number, y: number, confidence = 0.9) {
  return { text, box: { x, y, width: 40, height: 10 }, confidence };
}

beforeEach(() => {
  createEngine.mockReset();
  resetEngine(); // clear the module-level engine cache between tests
});

describe('recognize', () => {
  it('joins lines in reading order (top-to-bottom, then left-to-right)', async () => {
    const engineRecognize = vi.fn().mockResolvedValue([
      line('world', 60, 0),
      line('hello', 0, 0),
      line('again', 0, 40),
    ]);
    createEngine.mockResolvedValue({ backend: 'webgpu', recognize: engineRecognize });
    const res = await recognize({} as HTMLCanvasElement);
    expect(res.text).toBe('hello world\nagain');
    expect(res.backend).toBe('webgpu');
    expect(res.lines).toHaveLength(3);
  });

  it('throws OcrError(no-text) when nothing is detected', async () => {
    createEngine.mockResolvedValue({ backend: 'wasm', recognize: vi.fn().mockResolvedValue([]) });
    await expect(recognize({} as HTMLCanvasElement)).rejects.toMatchObject({ reason: 'no-text' });
  });

  it('wraps an inference failure as OcrError(inference) with the cause', async () => {
    createEngine.mockResolvedValue({ backend: 'wasm', recognize: vi.fn().mockRejectedValue(new Error('kernel died')) });
    await expect(recognize({} as HTMLCanvasElement)).rejects.toMatchObject({
      reason: 'inference',
      message: expect.stringContaining('kernel died'),
    });
  });
});

describe('getEngine init errors', () => {
  it('maps a network/fetch failure to model-download', async () => {
    createEngine.mockRejectedValueOnce(new Error('Failed to fetch model'));
    await expect(getEngine()).rejects.toMatchObject({ reason: 'model-download' });
  });

  it('maps other init failures to engine-unsupported and clears the cache for retry', async () => {
    createEngine.mockRejectedValueOnce(new Error('no wasm SIMD'));
    await expect(getEngine()).rejects.toMatchObject({ reason: 'engine-unsupported' });
    // cache cleared: a second call re-invokes createEngine (now succeeding)
    createEngine.mockResolvedValueOnce({ backend: 'wasm', recognize: vi.fn() });
    await expect(getEngine()).resolves.toMatchObject({ backend: 'wasm' });
    expect(createEngine).toHaveBeenCalledTimes(2);
  });
});

it('OcrError carries name and reason', () => {
  const e = new OcrError('input', 'bad file');
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe('OcrError');
  expect(e.reason).toBe('input');
});
