import { describe, it, expect, vi, beforeEach } from 'vitest';
import { frameToFile } from './camera.lib';

// Minimal canvas mock: records the size it was asked to draw and yields a blob.
beforeEach(() => {
  const ctx = { drawImage: vi.fn() };
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return document.createElement(tag);
    return {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/jpeg' })),
    } as unknown as HTMLCanvasElement;
  });
});

function fakeVideo(w: number, h: number): HTMLVideoElement {
  return { videoWidth: w, videoHeight: h } as HTMLVideoElement;
}

describe('frameToFile', () => {
  it('returns a JPEG File sized to the video frame', async () => {
    const file = await frameToFile(fakeVideo(640, 480));
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toBe('camera-capture.jpg');
  });

  it('uses a custom filename', async () => {
    const file = await frameToFile(fakeVideo(100, 100), 'shot.jpg');
    expect(file.name).toBe('shot.jpg');
  });

  it('rejects when the frame has no dimensions', async () => {
    await expect(frameToFile(fakeVideo(0, 0))).rejects.toThrow();
  });
});
