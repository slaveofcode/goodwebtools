import { describe, it, expect } from 'vitest';
import { beatInterval, clampBpm, isDownbeat, tapTempo } from './metronome.lib';

describe('metronome', () => {
  it('beatInterval from BPM', () => {
    expect(beatInterval(60)).toBe(1);
    expect(beatInterval(120)).toBe(0.5);
  });

  it('clamps BPM to range and rounds', () => {
    expect(clampBpm(10)).toBe(20);
    expect(clampBpm(999)).toBe(300);
    expect(clampBpm(119.6)).toBe(120);
  });

  it('accents the downbeat of each bar', () => {
    expect(isDownbeat(0, 4)).toBe(true);
    expect(isDownbeat(4, 4)).toBe(true);
    expect(isDownbeat(1, 4)).toBe(false);
  });

  it('tapTempo needs at least two taps', () => {
    expect(tapTempo([1000])).toBeNull();
  });

  it('tapTempo derives BPM from gaps', () => {
    // 500ms gaps = 120 BPM.
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
  });
});
