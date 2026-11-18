import { describe, it, expect, vi, beforeEach } from 'vitest';

const { caps, cancelFFmpeg } = vi.hoisted(() => ({
  caps: { video: new Set(['avc']), audio: new Set(['aac']), nativeAudio: new Set(['aac']) },
  cancelFFmpeg: vi.fn(),
}));
vi.mock('@/services/media/mediabunny.service', () => ({ getEncodeCaps: async () => caps }));
vi.mock('@/services/ffmpeg.service', () => ({ cancelFFmpeg }));

import { runWithFallback, MediaInputError } from './run-media.lib';
import type { MediaJob } from './engine.lib';

const job: MediaJob = { kind: 'compress-video', inputExt: 'mp4', needVideo: 'avc', needAudio: 'aac' };
const abort = () => new DOMException('Cancelled', 'AbortError');

describe('runWithFallback', () => {
  beforeEach(() => cancelFFmpeg.mockClear());

  it('uses the fast engine when it succeeds', async () => {
    const slow = vi.fn(async () => 'slow');
    const r = await runWithFallback(job, async () => 'fast', slow, new AbortController().signal);
    expect(r).toEqual({ value: 'fast', engine: 'mediabunny', fellBack: false });
    expect(slow).not.toHaveBeenCalled();
  });

  it('falls back to ffmpeg once when the fast engine fails', async () => {
    const r = await runWithFallback(job, async () => { throw new Error('boom'); }, async () => 'slow', new AbortController().signal);
    expect(r).toEqual({ value: 'slow', engine: 'ffmpeg', fellBack: true });
  });

  it('does not fall back when the user cancelled', async () => {
    const slow = vi.fn(async () => 'slow');
    await expect(runWithFallback(job, async () => { throw abort(); }, slow, new AbortController().signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(slow).not.toHaveBeenCalled();
  });

  it('does not fall back for a problem with the file itself (e.g. no audio track)', async () => {
    const slow = vi.fn(async () => 'slow');
    await expect(runWithFallback(job, async () => { throw new MediaInputError('no-audio'); }, slow, new AbortController().signal)).rejects.toMatchObject({ message: 'no-audio' });
    expect(slow).not.toHaveBeenCalled();
  });

  it('goes straight to ffmpeg when the engine choice says so', async () => {
    const fast = vi.fn(async () => 'fast');
    const r = await runWithFallback({ ...job, inputExt: 'avi' }, fast, async () => 'slow', new AbortController().signal);
    expect(fast).not.toHaveBeenCalled();
    expect(r).toEqual({ value: 'slow', engine: 'ffmpeg', fellBack: false });
  });

  it('cancelling a running ffmpeg job stops ffmpeg and rejects', async () => {
    const ctrl = new AbortController();
    const run = runWithFallback({ ...job, inputExt: 'avi' }, async () => 'fast', () => new Promise<string>(() => {}), ctrl.signal);
    ctrl.abort();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelFFmpeg).toHaveBeenCalledTimes(1);
  });
});
