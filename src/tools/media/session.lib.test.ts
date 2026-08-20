import { describe, it, expect } from 'vitest';
import { parseDur, dbToGain, resolveSegments, resolveSession, stereoToWav, type SessionPreset } from './session.lib';

const TINY: SessionPreset = {
  id: 'tiny',
  title: 'Tiny',
  fidelity: 'original',
  description: { en: 'test', id: 'tes' },
  defaultTotal: 600,
  defaults: { carrierBase: 200, nPairs: 2, harmonics: [1, 0.5] },
  segments: [
    { duration: 180, overlap: 20, groups: [{ name: 'entry', beat: { from: 14, to: 10 }, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
    { duration: 'hold', groups: [{ name: 'hold', beat: 10, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
  ],
  emerge: { duration: 60, targetBeat: 15 },
};

describe('parseDur', () => {
  it.each([
    ['3:00', 180], ['0:20', 20], ['20:00', 1200], ['1:05:00', 3900],
  ])('%s → %i s', (s, n) => expect(parseDur(s)).toBe(n));
});

describe('resolveSegments', () => {
  it('lays segments out with the crossfade overlap subtracted', () => {
    const segs = resolveSegments(TINY);
    expect(segs[0]).toMatchObject({ start: 0, dur: 180, ovOut: 20 });
    // Next starts where the crossfade begins: 180 - 20 = 160.
    expect(segs[1].start).toBe(160);
  });

  it("expands 'hold' to fill defaultTotal", () => {
    const segs = resolveSegments(TINY);
    expect(segs[1].dur).toBe(600 - 160);
    expect(segs[1].start + segs[1].dur).toBe(600);
  });
});

describe('resolveSession', () => {
  const r = resolveSession(TINY);

  it('total duration includes the emerge ramp', () => {
    expect(r.duration).toBe(660);
  });

  it('expands default harmonic stacks into one voice per pair', () => {
    // 2 segments × 1 group × 2 pairs = 4 voices.
    expect(r.voices).toHaveLength(4);
  });

  it('splits the beat symmetrically around the carrier (right ear higher)', () => {
    const v = r.voices[0]; // entry, pair 1: carrier 200, beat 14→10
    expect(v.freqL[0].v).toBeCloseTo(200 - 7, 5);
    expect(v.freqR[0].v).toBeCloseTo(200 + 7, 5);
    expect(v.freqR[1].v - v.freqL[1].v).toBeCloseTo(10, 5);
  });

  it('crossfades: first segment fades out over its overlap window', () => {
    const v = r.voices[0];
    const fadeStart = v.gain[2];
    const end = v.gain[3];
    expect(end.t).toBe(180);
    expect(fadeStart.t).toBe(160);
    expect(end.v).toBe(0);
  });

  it('second harmonic is quieter than the first', () => {
    const [v1, v2] = r.voices;
    expect(v2.gain[1].v).toBeCloseTo(v1.gain[1].v * 0.5, 6);
  });

  it('normalises the loudest layer to -6 dBFS', () => {
    expect(r.voices[0].gain[1].v).toBeCloseTo(dbToGain(-6), 6);
  });

  it('emerge ramps the final beat to the target', () => {
    const holdVoice = r.voices[2]; // hold group, pair 1
    const lastL = holdVoice.freqL[holdVoice.freqL.length - 1];
    const lastR = holdVoice.freqR[holdVoice.freqR.length - 1];
    expect(lastR.t).toBe(660);
    expect(lastR.v - lastL.v).toBeCloseTo(15, 5);
  });

  it('builds a continuous bed with a fade-out at the end', () => {
    expect(r.bed?.color).toBe('pink');
    const g = r.bed!.gain;
    expect(g[0]).toEqual({ t: 0, v: 0 });
    expect(g[g.length - 1]).toEqual({ t: 660, v: 0 });
  });

  it('handles explicit left/right and mono pairs', () => {
    const p: SessionPreset = {
      ...TINY,
      defaultTotal: undefined,
      emerge: null,
      segments: [{
        duration: 100,
        groups: [{ name: 'x', levelDb: 0, pairs: [{ left: 497, right: 493.3 }, { mono: 50 }] }],
      }],
    };
    const res = resolveSession(p);
    expect(res.voices[0].freqL[0].v).toBe(497);
    expect(res.voices[0].freqR[0].v).toBe(493.3);
    expect(res.voices[1].freqL[0].v).toBe(50);
    expect(res.voices[1].freqR[0].v).toBe(50);
  });

  it('high_ear left puts the higher carrier on the left', () => {
    const p: SessionPreset = {
      ...TINY,
      defaultTotal: undefined,
      emerge: null,
      segments: [{
        duration: 100,
        groups: [{ name: 'x', levelDb: 0, highEar: 'left', pairs: [{ center: 100, beat: 1.5 }] }],
      }],
    };
    const res = resolveSession(p);
    expect(res.voices[0].freqL[0].v).toBeGreaterThan(res.voices[0].freqR[0].v);
  });
});

describe('stereoToWav', () => {
  it('writes a valid 16-bit stereo RIFF header and interleaves samples', () => {
    const l = Float32Array.from([0, 1]);
    const rr = Float32Array.from([-1, 0]);
    const wav = stereoToWav(l, rr, 44100);
    expect(wav.length).toBe(44 + 2 * 4);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    const view = new DataView(wav.buffer);
    expect(view.getUint16(22, true)).toBe(2);       // stereo
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getInt16(44, true)).toBe(0);        // L0
    expect(view.getInt16(46, true)).toBe(-0x8000);  // R0
    expect(view.getInt16(48, true)).toBe(0x7fff);   // L1
  });
});
