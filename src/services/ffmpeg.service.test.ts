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

import { loadFFmpeg, cancelFFmpeg } from './ffmpeg.service';

describe('ffmpeg service', () => {
  it('cancel stops the running instance and the next load starts a fresh one', async () => {
    const first = await loadFFmpeg();
    expect(await loadFFmpeg()).toBe(first);
    cancelFFmpeg();
    expect(instances[0].terminate).toHaveBeenCalledTimes(1);
    const second = await loadFFmpeg();
    expect(second).not.toBe(first);
  });

  it('cancel with nothing loaded does nothing', () => {
    expect(() => cancelFFmpeg()).not.toThrow();
  });
});
