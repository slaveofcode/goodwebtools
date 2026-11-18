import { describe, it, expect, vi, beforeEach } from 'vitest';

const { caps, cancelFFmpeg, beginFFmpegJob, getEncodeCaps } = vi.hoisted(() => {
  const caps = { video: new Set(['avc']), audio: new Set(['aac']), nativeAudio: new Set(['aac']) };
  return { caps, cancelFFmpeg: vi.fn(), beginFFmpegJob: vi.fn(), getEncodeCaps: vi.fn(async () => caps) };
});
vi.mock('@/services/media/mediabunny.service', () => ({ getEncodeCaps }));
vi.mock('@/services/ffmpeg.service', () => ({ cancelFFmpeg, beginFFmpegJob }));

import { runWithFallback, MediaInputError } from './run-media.lib';
import type { MediaJob } from './engine.lib';

const job: MediaJob = { kind: 'compress-video', inputExt: 'mp4', needVideo: 'avc', needAudio: 'aac' };
const abort = () => new DOMException('Cancelled', 'AbortError');

describe('runWithFallback', () => {
  beforeEach(() => { cancelFFmpeg.mockClear(); getEncodeCaps.mockReset(); getEncodeCaps.mockImplementation(async () => caps); });

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
    let started!: () => void;
    const running = new Promise<void>(r => { started = r; });
    const run = runWithFallback({ ...job, inputExt: 'avi' }, async () => 'fast', () => { started(); return new Promise<string>(() => {}); }, ctrl.signal);
    await running;
    ctrl.abort();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelFFmpeg).toHaveBeenCalledTimes(1);
  });

  it('if the fast engine cannot even load (network, stale page), ffmpeg runs', async () => {
    getEncodeCaps.mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'));
    const r = await runWithFallback(job, async () => 'fast', async () => 'slow', new AbortController().signal);
    expect(r).toEqual({ value: 'slow', engine: 'ffmpeg', fellBack: false });
  });

  it('a cancel while choosing the engine never starts ffmpeg', async () => {
    const ctrl = new AbortController();
    getEncodeCaps.mockImplementationOnce(async () => { ctrl.abort(); return caps; });
    const slow = vi.fn(async () => 'slow');
    await expect(runWithFallback({ ...job, inputExt: 'avi' }, async () => 'fast', slow, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(slow).not.toHaveBeenCalled();
  });

  it('every ffmpeg run starts a fresh cancel scope', async () => {
    beginFFmpegJob.mockClear();
    await runWithFallback({ ...job, inputExt: 'avi' }, async () => 'fast', async () => 'slow', new AbortController().signal);
    expect(beginFFmpegJob).toHaveBeenCalledTimes(1);
  });
});
