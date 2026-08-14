import { describe, it, expect } from 'vitest';
import { parseSubtitles, parseTimestamp, formatTimestamp, toSrt, toVtt, shiftCues } from './subtitle.lib';

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,500 --> 00:00:08,000
Second line
across two rows`;

const VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world`;

describe('timestamps', () => {
  it('parses both SRT and VTT separators', () => {
    expect(parseTimestamp('00:00:01,500')).toBeCloseTo(1.5, 3);
    expect(parseTimestamp('00:01:02.250')).toBeCloseTo(62.25, 3);
  });
  it('formats with the requested separator', () => {
    expect(formatTimestamp(1.5, ',')).toBe('00:00:01,500');
    expect(formatTimestamp(62.25, '.')).toBe('00:01:02,250'.replace(',', '.'));
  });
});

describe('parseSubtitles', () => {
  it('parses SRT into cues', () => {
    const cues = parseSubtitles(SRT);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 1, end: 4, text: 'Hello world' });
    expect(cues[1].text).toBe('Second line\nacross two rows');
  });

  it('parses WebVTT (skipping the header)', () => {
    const cues = parseSubtitles(VTT);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello world');
  });

  it('skips malformed blocks', () => {
    expect(parseSubtitles('not a cue\n\nalso not')).toHaveLength(0);
  });
});

describe('serialization', () => {
  it('round-trips SRT', () => {
    expect(parseSubtitles(toSrt(parseSubtitles(SRT)))).toEqual(parseSubtitles(SRT));
  });
  it('converts SRT to VTT with dot separators and a header', () => {
    const vtt = toVtt(parseSubtitles(SRT));
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:01.000 --> 00:00:04.000');
  });
  it('shifts cue timing', () => {
    const shifted = shiftCues(parseSubtitles(SRT), 2);
    expect(shifted[0].start).toBe(3);
    expect(shiftCues(parseSubtitles(SRT), -100)[0].start).toBe(0);
  });
});
