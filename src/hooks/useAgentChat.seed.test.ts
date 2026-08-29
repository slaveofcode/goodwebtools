import { describe, it, expect } from 'vitest';
import { seedArgs } from './useAgentChat';
import { executorFor } from '@/tools/agent/executors';

describe('seedArgs — deterministic single-candidate arg seeding', () => {
  it('maps "1mb" onto a targetMb param (video-compress)', () => {
    const exec = executorFor('video-compress')!;
    expect(seedArgs(exec, 'compress this video to 1mb').targetMb).toBe(1);
    expect(seedArgs(exec, 'compress this video to 25mb').targetMb).toBe(25);
  });
  it('maps "100kb" onto a targetKb param (image-compress)', () => {
    const exec = executorFor('image-compress')!;
    expect(seedArgs(exec, 'compress this image to 100kb').targetKb).toBe(100);
  });
  it('converts MB→KB when the param is targetKb', () => {
    const exec = executorFor('image-compress')!;
    expect(seedArgs(exec, 'compress this image to 1mb').targetKb).toBe(1024);
  });
  it('returns no numeric arg when the message has no size (falls back to default)', () => {
    const exec = executorFor('video-compress')!;
    expect(seedArgs(exec, 'compress this video').targetMb).toBeUndefined();
  });
});
