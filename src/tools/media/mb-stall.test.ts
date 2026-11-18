// The stall watchdog: a conversion that stops reporting progress is cancelled
// and rejected (so runWithFallback hands it to ffmpeg) instead of hanging.
import { describe, it, expect, vi, afterEach } from 'vitest';

const fake = vi.hoisted(() => {
  const state = { cancelled: false, progressEveryMs: 0 };
  class Conversion {
    isValid = true;
    discardedTracks = [];
    onProgress?: (p: number) => void;
    private stop?: () => void;
    static async init() { return new Conversion(); }
    execute() {
      return new Promise<void>((_res, rej) => {
        this.stop = () => rej(new Error('cancelled'));
        if (state.progressEveryMs) {
          let p = 0;
          const tick = () => { p += 0.25; this.onProgress?.(p); if (p >= 1) _res(); else setTimeout(tick, state.progressEveryMs); };
          setTimeout(tick, state.progressEveryMs);
        }
      });
    }
    async cancel() { state.cancelled = true; this.stop?.(); }
  }
  const mb = {
    Conversion,
    Input: class { dispose() {} },
    BlobSource: class {},
    ALL_FORMATS: [],
    StreamTarget: class { constructor(_s: unknown) {} },
    Output: class { constructor(_o: unknown) {} },
    WebMOutputFormat: class {},
  };
  return { state, mb };
});

vi.mock('@/services/media/mediabunny.service', () => ({
  loadMediabunny: async () => fake.mb,
  ensureAudioEncoder: async () => {},
  getEncodeCaps: async () => null,
}));

import { mbRemux, STALL_MS } from './mb-media.lib';

afterEach(() => { vi.useRealTimers(); fake.state.cancelled = false; fake.state.progressEveryMs = 0; });

describe('stall watchdog', () => {
  it('cancels and rejects with mb-stalled when no progress arrives', async () => {
    vi.useFakeTimers();
    const run = mbRemux(new Blob(['x']), 'webm');
    const settled = run.then(() => 'resolved', (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(STALL_MS + 10);
    expect(await settled).toBe('mb-stalled');
    expect(fake.state.cancelled).toBe(true);
  });

  it('leaves a slow conversion alone while it keeps making progress', async () => {
    vi.useFakeTimers();
    fake.state.progressEveryMs = STALL_MS - 1000; // slow but steady: 4 ticks
    const run = mbRemux(new Blob(['x']), 'webm');
    const settled = run.then(() => 'resolved', (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(STALL_MS * 5);
    expect(await settled).not.toBe('mb-stalled');
    expect(fake.state.cancelled).toBe(false);
  });
});
