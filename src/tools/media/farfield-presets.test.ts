import { describe, it, expect } from 'vitest';
import { SESSION_PRESETS, presetById } from './farfield-presets';
import { resolveSession } from './session.lib';

describe('farfield presets', () => {
  it.each(SESSION_PRESETS.map((p) => [p.id] as const))('%s resolves without error', (id) => {
    const r = resolveSession(presetById(id));
    expect(r.duration).toBeGreaterThan(60);
    expect(r.voices.length).toBeGreaterThan(0);
    // Every automation point lies within the session.
    for (const v of r.voices) {
      for (const pt of [...v.freqL, ...v.freqR, ...v.gain]) {
        expect(pt.t).toBeGreaterThanOrEqual(0);
        expect(pt.t).toBeLessThanOrEqual(r.duration + 1e-6);
      }
      // Gains normalised (≤ -6 dBFS reference = ~0.501).
      for (const pt of v.gain) expect(pt.v).toBeLessThanOrEqual(0.502);
      // Frequencies stay positive and audible-ish.
      for (const pt of [...v.freqL, ...v.freqR]) expect(pt.v).toBeGreaterThan(10);
    }
  });

  it('resolved totals match the source material', () => {
    expect(resolveSession(presetById('relaxation')).duration).toBe(1200 + 180);
    expect(resolveSession(presetById('sleep-90')).duration).toBe(5400);
    expect(resolveSession(presetById('focus-10')).duration).toBe(1800);
    expect(resolveSession(presetById('wake')).duration).toBe(300);
  });

  it('sleep-90 has no emerge by design', () => {
    expect(presetById('sleep-90').emerge).toBeNull();
  });

  it('focus-10 keeps the reversed pair C (left carries the higher frequency)', () => {
    const r = resolveSession(presetById('focus-10'));
    const c = r.voices.find((v) => v.name === 'C')!;
    expect(c.freqL[0].v).toBeGreaterThan(c.freqR[0].v);
  });

  it('focus-12 puts the high member on the left ear throughout', () => {
    const r = resolveSession(presetById('focus-12'));
    const delta = r.voices.find((v) => v.name === 'delta')!;
    expect(delta.freqL[0].v).toBeGreaterThan(delta.freqR[0].v);
  });
});
