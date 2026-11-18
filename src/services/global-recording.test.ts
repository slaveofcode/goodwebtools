// Stopping a recording ends the "recording" state at once — re-packing the
// file afterwards must not keep the REC state (or a hidden window) around.
import { describe, it, expect, vi } from 'vitest';

const h = vi.hoisted(() => {
  let release: (b: Blob) => void = () => {};
  return {
    finishing: new Promise<Blob>(r => { release = r; }),
    release: (b: Blob) => release(b),
  };
});

vi.mock('./capture', () => ({
  captureService: {
    startRecording: vi.fn(async () => ({ id: 1 })),
    stopRecording: vi.fn(async () => new Blob(['raw'], { type: 'video/webm' })),
  },
}));
vi.mock('./platform', () => ({ isTauri: () => false }));
vi.mock('@/tools/media/recording-finish.lib', () => ({ finishRecording: () => h.finishing }));

import { startManaged, stopManaged, isRecording } from './global-recording';

describe('stopManaged', () => {
  it('reports "not recording" before the file is re-packed, then hands over the re-packed file', async () => {
    const states: boolean[] = [];
    window.addEventListener('gwt:recording-state', e => states.push(!!(e as CustomEvent).detail?.recording));
    let result: Blob | null = null;
    window.addEventListener('gwt:recording-result', e => { result = (e as CustomEvent).detail.blob; });

    await startManaged({ format: 'webm', fps: 30, includeAudio: false, manageWindow: false });
    expect(isRecording()).toBe(true);

    const stopping = stopManaged();
    await vi.waitFor(() => expect(isRecording()).toBe(false));
    expect(states.at(-1)).toBe(false);
    expect(result).toBeNull(); // still re-packing

    const fixed = new Blob(['fixed'], { type: 'video/webm' });
    h.release(fixed);
    expect(await stopping).toBe(fixed);
    expect(result).toBe(fixed);
  });
});
