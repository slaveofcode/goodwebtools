import { describe, it, expect } from 'vitest';
import { qrScaleTargets } from './qr-decode.lib';

describe('qrScaleTargets', () => {
  it('retries at several downscaled sizes for a large photo', () => {
    const t = qrScaleTargets(4080, 3060);
    expect(t[0]).toBe(1600); // capped full-size pass
    expect(t).toContain(1000);
    expect(t).toContain(700 - 100); // 600
    // strictly de-duplicated and each within the image size
    expect(new Set(t).size).toBe(t.length);
    expect(Math.max(...t)).toBeLessThanOrEqual(4080);
  });

  it('never upscales a small image', () => {
    const t = qrScaleTargets(480, 480);
    expect(Math.max(...t)).toBeLessThanOrEqual(480);
  });

  it('always offers at least one target', () => {
    expect(qrScaleTargets(300, 300).length).toBeGreaterThan(0);
  });
});
