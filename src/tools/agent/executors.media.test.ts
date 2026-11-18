import { describe, it, expect, vi, beforeEach } from 'vitest';

// The assistant's media actions run on the same engine choice as the tool pages:
// mediabunny when the browser can, ffmpeg.wasm otherwise — and say which ran.
const { runWithFallback, mb, ff } = vi.hoisted(() => ({
  runWithFallback: vi.fn(),
  mb: {
    mbCompressVideo: vi.fn(async () => ({ blob: new Blob(['v'], { type: 'video/mp4' }), attempts: 1, width: 640, height: 360 })),
    mbConvertVideo: vi.fn(async () => new Blob(['w'], { type: 'video/webm' })),
    mbExtractAudio: vi.fn(async () => ({ blob: new Blob(['a'], { type: 'audio/mpeg' }), ext: 'mp3' })),
    mbConvertAudio: vi.fn(async () => new Blob(['m'], { type: 'audio/mpeg' })),
    mbTrim: vi.fn(async () => ({ blob: new Blob(['t'], { type: 'video/mp4' }), ext: 'mp4' })),
  },
  ff: {
    getMediaDuration: vi.fn(async () => 3),
    compressVideo: vi.fn(), convertVideo: vi.fn(), compressAudio: vi.fn(), extractAudio: vi.fn(), trimMedia: vi.fn(),
    computeAudioKbps: (b: number, d: number) => Math.round((b * 8) / d / 1000),
    VIDEO_FORMATS: [{ id: 'mp4' }, { id: 'webm' }, { id: 'mov' }],
  },
}));
vi.mock('@/tools/media/run-media.lib', () => ({ runWithFallback }));
vi.mock('@/tools/media/mb-media.lib', () => mb);
vi.mock('@/tools/media/encode.lib', () => ff);

import { executorFor } from './executors';

const file = (name: string, type: string) => new File(['x'], name, { type });
const fastRun = async (_job: unknown, fast: (s: AbortSignal) => Promise<unknown>) => ({ value: await fast(new AbortController().signal), engine: 'mediabunny', fellBack: false });

describe('assistant media actions use the fast engine', () => {
  beforeEach(() => { runWithFallback.mockReset(); runWithFallback.mockImplementation(fastRun); });

  it('compress video runs through runWithFallback and says fast mode', async () => {
    const r = await executorFor('video-compress')!.execute({ files: { file: file('a.mp4', 'video/mp4') }, params: { targetMb: 8 } });
    expect(runWithFallback).toHaveBeenCalledTimes(1);
    expect(mb.mbCompressVideo).toHaveBeenCalled();
    expect(r.filename).toBe('compressed.mp4');
    expect(r.text).toMatch(/\(fast mode\)$/);
  });

  it('extract audio still gives an MP3 (the request is "mp4 to mp3")', async () => {
    const r = await executorFor('video-to-audio')!.execute({ files: { file: file('a.mp4', 'video/mp4') }, params: {} });
    expect(mb.mbExtractAudio).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ as: 'mp3' }), expect.anything(), expect.anything());
    expect(r.filename).toBe('audio.mp3');
  });

  it('says compatibility mode when ffmpeg ran', async () => {
    runWithFallback.mockImplementation(async () => ({ value: { blob: new Blob(['t']), ext: 'mp4' }, engine: 'ffmpeg', fellBack: true }));
    const r = await executorFor('media-trim')!.execute({ files: { file: file('a.mp4', 'video/mp4') }, params: { start: '0', end: '2' } });
    expect(r.text).toMatch(/\(compatibility mode\)$/);
  });

  it('convert video and compress audio go through the same runner', async () => {
    await executorFor('video-convert')!.execute({ files: { file: file('a.mp4', 'video/mp4') }, params: { format: 'webm' } });
    await executorFor('audio-convert')!.execute({ files: { file: file('a.wav', 'audio/wav') }, params: { targetMb: 1 } });
    expect(runWithFallback).toHaveBeenCalledTimes(2);
    expect(mb.mbConvertVideo).toHaveBeenCalled();
    expect(mb.mbConvertAudio).toHaveBeenCalled();
  });
});
