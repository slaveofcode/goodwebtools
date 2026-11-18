import { describe, it, expect } from 'vitest';
import { computeTargetBitrate, estimateBytes, MIN_VIDEO_KBPS, planResolution, sizeRetryKbps } from './video-compress.lib';

describe('computeTargetBitrate', () => {
  it('keeps the requested audio when the budget is comfortable', () => {
    // 10 MB over 100 s at overhead 1 → 800 kbps budget; 128 for audio, 672 video.
    const plan = computeTargetBitrate({ targetBytes: 10_000_000, durationSec: 100, audioKbps: 128, overhead: 1 });
    expect(plan.audioKbps).toBe(128);
    expect(plan.videoKbps).toBe(672);
    expect(plan.overBudget).toBe(false);
    // Estimate should land back on the target.
    expect(plan.estimatedBytes).toBe(10_000_000);
  });

  it('steps the audio down a ladder when video would fall below the floor', () => {
    // 2,000,000 bytes over 80 s at overhead 1 → 200 kbps budget.
    // audio 128 → video 72 (< 100), so drop to 96 → video 104 (ok).
    const plan = computeTargetBitrate({ targetBytes: 2_000_000, durationSec: 80, audioKbps: 128, overhead: 1 });
    expect(plan.audioKbps).toBe(96);
    expect(plan.videoKbps).toBe(104);
    expect(plan.overBudget).toBe(false);
  });

  it('flags overBudget and clamps to the floor when nothing fits', () => {
    // 100,000 bytes over 100 s at overhead 1 → 8 kbps budget: impossible.
    const plan = computeTargetBitrate({ targetBytes: 100_000, durationSec: 100, audioKbps: 128, overhead: 1 });
    expect(plan.overBudget).toBe(true);
    expect(plan.videoKbps).toBe(MIN_VIDEO_KBPS);
    expect(plan.audioKbps).toBe(0);
  });

  it('drops audio when requested audioKbps is 0', () => {
    const plan = computeTargetBitrate({ targetBytes: 10_000_000, durationSec: 100, audioKbps: 0, overhead: 1 });
    expect(plan.audioKbps).toBe(0);
    expect(plan.videoKbps).toBe(800);
  });

  it('applies the default overhead headroom (< raw budget)', () => {
    const plan = computeTargetBitrate({ targetBytes: 10_000_000, durationSec: 100, audioKbps: 0 });
    // default overhead 0.95 → 760 video, under the raw 800.
    expect(plan.videoKbps).toBe(760);
  });

  it('throws on non-positive duration or target', () => {
    expect(() => computeTargetBitrate({ targetBytes: 1000, durationSec: 0, audioKbps: 0 })).toThrow();
    expect(() => computeTargetBitrate({ targetBytes: 0, durationSec: 10, audioKbps: 0 })).toThrow();
  });
});

describe('estimateBytes', () => {
  it('is the inverse of the bitrate budget', () => {
    expect(estimateBytes(672, 128, 100)).toBe(10_000_000);
    expect(estimateBytes(100, 0, 1)).toBe(12_500);
  });
});

describe('planResolution', () => {
  const hd = { width: 1920, height: 1080, rotation: 0 as const };
  it('keeps full HD when the bitrate is comfortable', () => {
    expect(planResolution(hd, 2500, 0)).toEqual({ width: 1920, height: 1080 });
  });
  it('drops to 720p when the bitrate is too low for 1080p', () => {
    expect(planResolution(hd, 1200, 0)).toEqual({ width: 1280, height: 720 });
  });
  it('drops to 480p for very low bitrates', () => {
    expect(planResolution(hd, 500, 0)).toEqual({ width: 854, height: 480 });
  });
  it('limits the shorter side of a portrait phone video (rotation metadata)', () => {
    expect(planResolution({ width: 1920, height: 1080, rotation: 90 }, 1200, 0)).toEqual({ width: 720, height: 1280 });
  });
  it('applies the user max width to the displayed width', () => {
    expect(planResolution(hd, 2500, 640)).toEqual({ width: 640, height: 360 });
  });
  it('never upscales a small source', () => {
    expect(planResolution({ width: 640, height: 360, rotation: 0 }, 500, 0)).toEqual({ width: 640, height: 360 });
  });
});

describe('sizeRetryKbps', () => {
  it('does not retry when the result is within 2% of the target', () => {
    expect(sizeRetryKbps(16e6, 16.2e6, 1000)).toBeNull();
  });
  it('scales the bitrate down by the overshoot with a small margin', () => {
    expect(sizeRetryKbps(16e6, 18e6, 1000)).toBe(862);
  });
  it('never goes below the minimum video bitrate', () => {
    expect(sizeRetryKbps(16e6, 80e6, 120)).toBe(MIN_VIDEO_KBPS);
  });
});
