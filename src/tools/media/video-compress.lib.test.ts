import { describe, it, expect } from 'vitest';
import { computeTargetBitrate, estimateBytes, MIN_VIDEO_KBPS } from './video-compress.lib';

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
