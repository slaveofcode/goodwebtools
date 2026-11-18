import { describe, it, expect, vi } from 'vitest';

const instances: { terminate: ReturnType<typeof vi.fn> }[] = [];
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    terminate = vi.fn();
    constructor() { instances.push(this); }
    async load() {}
  },
}));
vi.mock('@ffmpeg/util', () => ({ toBlobURL: async (u: string) => u, fetchFile: async () => new Uint8Array() }));

import { loadFFmpeg, cancelFFmpeg, beginFFmpegJob } from './ffmpeg.service';

describe('ffmpeg service', () => {
  it('cancel stops the running instance and the next load starts a fresh one', async () => {
    const first = await loadFFmpeg();
    expect(await loadFFmpeg()).toBe(first);
    cancelFFmpeg();
    expect(instances[0].terminate).toHaveBeenCalledTimes(1);
    beginFFmpegJob(); // the next job starts a fresh cancel scope
    const second = await loadFFmpeg();
    expect(second).not.toBe(first);
  });

  it('cancel with nothing loaded does nothing', () => {
    expect(() => cancelFFmpeg()).not.toThrow();
  });

  it('a cancel before ffmpeg has loaded sticks: the pending load throws and the instance is stopped', async () => {
    cancelFFmpeg(); // reset any instance from earlier tests
    beginFFmpegJob();
    const loading = loadFFmpeg();
    cancelFFmpeg();
    await expect(loading).rejects.toMatchObject({ name: 'AbortError' });
    expect(instances[instances.length - 1].terminate).toHaveBeenCalled();
  });

  it('a cancel before the job even asked for ffmpeg makes the next load throw, until a new job begins', async () => {
    beginFFmpegJob();
    cancelFFmpeg();
    await expect(loadFFmpeg()).rejects.toMatchObject({ name: 'AbortError' });
    beginFFmpegJob();
    await expect(loadFFmpeg()).resolves.toBeTruthy();
  });
});
