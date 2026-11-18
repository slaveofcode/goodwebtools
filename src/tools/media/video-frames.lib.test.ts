import { describe, it, expect } from 'vitest';
import { frameTimes, frameFileName, MAX_FRAMES } from './video-frames.lib';

describe('frameTimes', () => {
  it('takes a frame every N seconds from the start', () => {
    expect(frameTimes(3, 1)).toEqual({ times: [0, 1, 2], capped: false });
    expect(frameTimes(2, 0.5)).toEqual({ times: [0, 0.5, 1, 1.5], capped: false });
  });
  it(`stops at ${MAX_FRAMES} frames on a long video`, () => {
    const r = frameTimes(7200, 0.5);
    expect(r.times).toHaveLength(300);
    expect(r.capped).toBe(true);
  });
  it('uses at least 0.1 s between frames', () => {
    expect(frameTimes(0.35, 0).times).toEqual([0, 0.1, 0.2, 0.3]);
  });
  it('gives nothing for an empty video', () => {
    expect(frameTimes(0, 1)).toEqual({ times: [], capped: false });
  });
});

describe('frameFileName', () => {
  it.each([
    ['clip', 3.5, 'png', 'clip-00m03.500s.png'],
    ['a', 3725.25, 'jpg', 'a-62m05.250s.jpg'],
    ['x', 0, 'webp', 'x-00m00.000s.webp'],
  ] as const)('%s at %s s → %s', (base, t, ext, out) => {
    expect(frameFileName(base, t, ext)).toBe(out);
  });
});
