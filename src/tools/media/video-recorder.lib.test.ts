import { describe, it, expect, afterEach, vi } from 'vitest';
import { pickRecordingType, formatDuration, resolutionConstraint } from './video-recorder.lib';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pickRecordingType', () => {
  it('falls back when MediaRecorder is unavailable (jsdom)', () => {
    expect(pickRecordingType()).toEqual({ mime: '', ext: 'webm' });
  });

  it('picks the first supported candidate', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (m: string) => m === 'video/webm;codecs=vp8,opus' || m === 'video/webm',
    });
    expect(pickRecordingType()).toEqual({ mime: 'video/webm;codecs=vp8,opus', ext: 'webm' });
  });

  it('prefers vp9 when supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true });
    expect(pickRecordingType()).toEqual({ mime: 'video/webm;codecs=vp9,opus', ext: 'webm' });
  });

  it('uses mp4 when only mp4 is supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'video/mp4' });
    expect(pickRecordingType()).toEqual({ mime: 'video/mp4', ext: 'mp4' });
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [1000, '0:01'],
    [61_000, '1:01'],
    [600_000, '10:00'],
    [3_661_000, '1:01:01'],
    [-500, '0:00'],
  ])('formatDuration(%i) → %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe('resolutionConstraint', () => {
  it.each([
    ['480p', 854, 480],
    ['720p', 1280, 720],
    ['1080p', 1920, 1080],
  ] as const)('%s → %ix%i', (res, w, h) => {
    expect(resolutionConstraint(res)).toEqual({ width: w, height: h });
  });
});
